import test from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_SUITES, fullPlan, selectChecks } from '../../../scripts/ci/select.mjs';
import { commandsFor, runChecks } from '../../../scripts/ci/checks.mjs';
import { browserShards } from '../../../scripts/ci/plan.mjs';

test('CI fast and browser phases partition the original gate without dropping checks', () => {
  const plan = fullPlan();
  assert.deepEqual(
    [...commandsFor(plan, { phase: 'fast' }), ...commandsFor(plan, { phase: 'browser' })],
    commandsFor(plan),
  );
  assert.deepEqual(commandsFor(plan, { phase: 'browser', shard: '2/4' }), [
    [
      'run',
      'test:e2e',
      '--',
      '--fully-parallel',
      '--shard=2/4',
      '--forbid-only',
      '--update-snapshots=none',
    ],
  ]);
  assert.deepEqual(
    commandsFor(selectChecks(['test/e2e/boot.spec.js']), {
      phase: 'browser',
      shard: '1/1',
    }),
    [
      [
        'run',
        'test:e2e',
        '--',
        'test/e2e/boot.spec.js',
        '--fully-parallel',
        '--shard=1/1',
        '--forbid-only',
        '--update-snapshots=none',
      ],
    ],
  );
  for (const shard of ['0/4', '5/4', '2/1', '--grep', '1/40'])
    assert.throws(() => commandsFor(plan, { phase: 'browser', shard }), /Shard/);
});

test('full coverage uses four shards, narrow selections use only the needed runners', () => {
  assert.deepEqual(browserShards(fullPlan()), [1, 2, 3, 4]);
  assert.deepEqual(browserShards(selectChecks(['test/e2e/boot.spec.js'])), [1]);
  assert.deepEqual(
    browserShards(selectChecks(['test/e2e/boot.spec.js', 'test/e2e/menu.spec.js'])),
    [1, 2],
  );
  assert.deepEqual(browserShards(selectChecks(['README.md'])), [1]);
});

test('docs-only changes keep lint and format without unit, build or browser work', () => {
  const plan = selectChecks(['docs/DEVELOPMENT.md', 'CONTRIBUTING.md', 'AGENTS.md', 'CLAUDE.md']);
  assert.equal(plan.mode, 'affected');
  assert.deepEqual(commandsFor(plan), [
    ['run', 'lint'],
    ['run', 'format:check'],
  ]);
});

test('manual import tools and fixtures keep all unit tests without browser work', () => {
  for (const file of [
    'scripts/sync-content.mjs',
    'scripts/sync/run.mjs',
    'test/fixtures/sync/news.rss.xml',
    'test/unit/sync/adapter-html.test.js',
  ]) {
    const plan = selectChecks([file]);
    assert.equal(plan.unit, true, file);
    assert.equal(plan.build, false, file);
    assert.deepEqual(plan.e2e, [], file);
  }
});

test('unit test changes run the whole unit suite', () => {
  const plan = selectChecks(['test/unit/text/wrap.test.js']);
  assert.deepEqual(commandsFor(plan).at(-1), ['run', 'test:unit']);
  assert.equal(plan.build, false);
});

test('direct e2e changes run build invariants, bundle and exactly the changed specs', () => {
  const files = ['test/e2e/cursor.spec.js', 'test/e2e/boot.spec.js'];
  const plan = selectChecks(files, () => true);
  assert.equal(plan.build, true);
  assert.deepEqual(commandsFor(plan).slice(2), [
    ['run', 'test:build'],
    ['run', 'build'],
    ['run', 'test:e2e', '--', ...files.toSorted()],
  ]);
});

test('cursor leaf includes every interaction consumer plus boot, fallback and visual proof', () => {
  const plan = selectChecks(['src/input/cursor.js'], () => true);
  assert.equal(plan.unit, true);
  assert.equal(plan.build, true);
  assert.deepEqual(plan.e2e, [...CURSOR_SUITES].sort());
  assert.equal(plan.e2e.length, 8);
});

test('mixed isolated changes take the union, with deterministic deduplication', () => {
  const plan = selectChecks(
    ['docs/CI.md', 'src/input/cursor.js', 'test/e2e/cursor.spec.js', 'scripts/sync/run.mjs'],
    () => true,
  );
  assert.deepEqual(plan.e2e, [...CURSOR_SUITES].sort());
});

test('shared, unknown, renamed and configuration inputs always select full proof', () => {
  const files = [
    'src/main.js',
    'src/scene/layout.js',
    'src/input/pointer.js',
    'src/runtime/loop.js',
    'src/text/wrap.js',
    'src/machine/menu.js',
    'site/styles.css',
    'assets/monitor.webp',
    'vendor/three.js',
    'build/build.mjs',
    'package.json',
    'package-lock.json',
    'mise.toml',
    'playwright.config.js',
    'eslint.config.js',
    '.prettierignore',
    'hk.pkl',
    '.github/workflows/ci.yml',
    'scripts/ci/select.mjs',
    'content/pages/MEETUPS.json',
    'content/sources.json',
    'test/e2e/helpers/page.js',
    'test/e2e/__screenshots__/cursor.spec.js/desktop-cursor.png',
    'docs/executable.js',
    'README.md\nnew-path',
    'future-component/file.js',
  ];
  for (const file of files) assert.equal(selectChecks(['README.md', file]).mode, 'full', file);
});

test('missing specs, missing leaf coverage and empty discovery fall back to full', () => {
  assert.equal(selectChecks(['test/e2e/cursor.spec.js'], () => false).mode, 'full');
  assert.equal(
    selectChecks(['src/input/cursor.js'], (file) => !file.endsWith('touch.spec.js')).mode,
    'full',
  );
  assert.equal(selectChecks([]).mode, 'full');
  assert.equal(selectChecks(null).mode, 'full');
});

test('full plan runs every stage and an unfiltered browser suite', () => {
  assert.deepEqual(commandsFor(fullPlan()), [
    ['run', 'lint'],
    ['run', 'format:check'],
    ['run', 'test:unit'],
    ['run', 'test:build'],
    ['run', 'build'],
    ['run', 'test:e2e'],
  ]);
});

test('a failed stage stops verification before build or browser can proceed', () => {
  const calls = [];
  const code = runChecks(fullPlan(), (command, args) => {
    calls.push([command, ...args]);
    return { status: args.includes('format:check') ? 23 : 0 };
  });
  assert.equal(code, 23);
  assert.deepEqual(calls, [
    ['npm', 'run', 'lint'],
    ['npm', 'run', 'format:check'],
  ]);
  assert.equal(
    runChecks(fullPlan(), () => ({ status: null })),
    1,
  );
  assert.throws(
    () => runChecks(fullPlan(), () => ({ error: new Error('missing npm') })),
    /missing npm/,
  );
});
