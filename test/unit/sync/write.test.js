import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJson, readJson, orderKeys, serialise } from '../../../scripts/sync/write.mjs';
import { syncPage, guard, report } from '../../../scripts/sync/run.mjs';
import { diffNodes, summarisePage } from '../../../scripts/sync/diff.mjs';

const PAGE = {
  key: 'DEMO',
  title: 'DEMO',
  url: 'https://omarchy.org/demo/',
  nodes: [
    ['H2', 'Hello'],
    ['P', 'A paragraph.'],
  ],
};

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'sync-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('keys are written in a fixed order whatever order they arrive in', () => {
  assert.deepEqual(Object.keys(orderKeys({ nodes: [], url: 'u', title: 't', key: 'K' })), [
    'key',
    'title',
    'url',
    'nodes',
  ]);
});

test('unknown keys survive, appended after the known ones', () => {
  assert.deepEqual(Object.keys(orderKeys({ extra: 1, key: 'K' })), ['key', 'extra']);
});

test('output is 2-space JSON with a trailing newline, as prettier wants', async () => {
  const text = await serialise('content/pages/DEMO.json', PAGE);
  assert.ok(text.endsWith('}\n'));
  assert.ok(text.includes('\n  "title": "DEMO",'));
  assert.ok(!text.includes('\t'));
});

test('the writer is idempotent: a second write changes nothing on disk', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'DEMO.json');
    const first = await writeJson(file, PAGE);
    assert.equal(first.changed, true);

    const before = await stat(file);
    const second = await writeJson(file, PAGE);
    assert.equal(second.changed, false, 'no change reported');
    const after = await stat(file);
    assert.equal(before.mtimeMs, after.mtimeMs, 'and the file is not rewritten');
  });
});

test('re-serialising already-serialised output is a fixed point', async () => {
  const once = await serialise('content/pages/DEMO.json', PAGE);
  const twice = await serialise('content/pages/DEMO.json', JSON.parse(once));
  assert.equal(once, twice);
});

test('a dry run reports the change but writes nothing', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'DEMO.json');
    const result = await writeJson(file, PAGE, { dryRun: true });
    assert.equal(result.changed, true);
    assert.equal(await readJson(file), undefined, 'the file was never created');
  });
});

test('readJson returns undefined for a missing file rather than throwing', async () => {
  assert.equal(await readJson(join(tmpdir(), 'definitely-not-here-9137.json')), undefined);
});

test('the guard rejects an empty or collapsed page', () => {
  const current = { nodes: new Array(20).fill(['P', 'x']) };
  assert.throws(() => guard('DEMO', {}, { title: 'T', nodes: [] }, current), /no nodes/);
  assert.throws(
    () => guard('DEMO', { minNodes: 10 }, { title: 'T', nodes: [['P', 'x']] }, undefined),
    /below minNodes/,
  );
  assert.throws(
    () => guard('DEMO', {}, { title: 'T', nodes: new Array(5).fill(['P', 'x']) }, current),
    /lost more than half/,
  );
  assert.ok(guard('DEMO', {}, { title: 'T', nodes: new Array(20).fill(['P', 'x']) }, current));
});

test('a failing source leaves the committed file untouched and is reported', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'content/pages/demo.json');
    await writeJson(file, PAGE);
    const original = await readFile(file, 'utf8');

    const deps = {
      fetchText: async () => {
        throw new Error('ECONNRESET');
      },
      fetchJson: async () => {
        throw new Error('ECONNRESET');
      },
    };
    const result = await syncPage(
      'DEMO',
      { adapter: 'html', url: 'https://omarchy.org/demo/' },
      { root: dir, deps, dryRun: false },
    );

    assert.equal(result.ok, false);
    assert.match(result.error, /ECONNRESET/);
    assert.equal(await readFile(file, 'utf8'), original, 'the good snapshot survived');
  });
});

test('a failed page makes the whole run exit non-zero', () => {
  const { failed, text } = report(
    [
      { key: 'A', ok: true, changed: false, lines: [] },
      { key: 'B', ok: false, error: 'boom', lines: [] },
    ],
    { dryRun: false },
  );
  assert.equal(failed, 1);
  assert.match(text, /B\s+FAILED\s+boom/);
});

test('a static source is reported as skipped, not as changed', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'content/pages/demo.json');
    await writeJson(file, PAGE);
    const result = await syncPage(
      'DEMO',
      { adapter: 'static', url: 'https://omarchy.org/demo/', reason: 'no text on the page' },
      { root: dir, deps: {}, dryRun: false },
    );
    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
    assert.equal(result.skipped, 'no text on the page');
  });
});

test('a static source without a reason is refused', async () => {
  await withTempDir(async (dir) => {
    await writeJson(join(dir, 'content/pages/demo.json'), PAGE);
    const result = await syncPage(
      'DEMO',
      { adapter: 'static', url: 'https://omarchy.org/demo/' },
      { root: dir, deps: {}, dryRun: false },
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /needs a "reason"/);
  });
});

test('an unknown adapter name fails with a useful message', async () => {
  await withTempDir(async (dir) => {
    const result = await syncPage(
      'DEMO',
      { adapter: 'not-a-real-adapter', url: 'https://x.test/' },
      { root: dir, deps: {}, dryRun: false },
    );
    assert.match(result.error, /no adapter "not-a-real-adapter"/);
  });
});

test('the diff counts nodes added and removed, ignoring order', () => {
  const before = [
    ['H2', 'A'],
    ['P', 'B'],
  ];
  assert.deepEqual(diffNodes(before, [...before].reverse()), {
    added: [],
    removed: [],
    before: 2,
    after: 2,
  });
  const changed = diffNodes(before, [
    ['H2', 'A'],
    ['P', 'C'],
  ]);
  assert.deepEqual(changed.added, [['P', 'C']]);
  assert.deepEqual(changed.removed, [['P', 'B']]);
});

test('an unchanged page produces no summary lines at all', () => {
  assert.deepEqual(summarisePage('DEMO', PAGE, PAGE), []);
});

test('the summary names the page, the totals and a sample of each side', () => {
  const lines = summarisePage('DEMO', PAGE, {
    ...PAGE,
    nodes: [...PAGE.nodes, ['P', 'New.']],
  });
  assert.match(lines[0], /^DEMO: 2 -> 3 nodes \(\+1 \/ -0\)$/);
  assert.deepEqual(lines[1], '  + P New.');
});

test('a page written by the sync round-trips through readJson unchanged', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'DEMO.json');
    await writeJson(file, PAGE);
    assert.deepEqual(await readJson(file), PAGE);
  });
});

test('hand-editing a file the sync then rewrites is detected as a change', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'DEMO.json');
    await writeJson(file, PAGE);
    await writeFile(file, JSON.stringify(PAGE), 'utf8');
    assert.equal((await writeJson(file, PAGE)).changed, true, 'formatting alone is a change');
  });
});
