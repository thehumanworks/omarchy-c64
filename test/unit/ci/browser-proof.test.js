import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  beginProof,
  canReuse,
  completePass,
  fingerprint,
  finishProof,
} from '../../../scripts/ci/browser-proof.mjs';

const passed = { errors: [], stats: { expected: 68, unexpected: 0, skipped: 0, flaky: 0 } };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omarchy-proof-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'test'));
  fs.writeFileSync(path.join(root, 'page.html'), 'built page');
  fs.writeFileSync(path.join(root, 'test/a.js'), 'assertions');
  const receipt = path.join(root, '.cache/browser.json');
  const digest = (context = { node: '26', browser: '123' }) =>
    fingerprint(root, context, ['page.html', 'test']);
  return { root, receipt, digest };
}

test('reuse requires a complete recent pass for exactly the same bytes and execution context', (t) => {
  const { root, receipt, digest } = fixture(t);
  const before = digest();
  assert.equal(canReuse(receipt, before), false);
  const id = beginProof(receipt);
  assert.equal(canReuse(receipt, before), false);
  assert.equal(
    finishProof(receipt, id, { before, after: digest(), report: passed, status: 0 }),
    true,
  );
  assert.equal(canReuse(receipt, before), true);
  assert.equal(canReuse(receipt, digest({ node: '27', browser: '123' })), false);
  assert.equal(canReuse(receipt, before, Date.now() + 25 * 60 * 60 * 1000), false);
  assert.equal(canReuse(receipt, before, 0), false);
  fs.writeFileSync(path.join(root, 'page.html'), 'changed build');
  assert.equal(canReuse(receipt, digest()), false);
});

test('test edits, additions, removals and missing inputs invalidate the fingerprint', (t) => {
  const { root, digest } = fixture(t);
  const before = digest();
  fs.writeFileSync(path.join(root, 'test/a.js'), 'new assertions');
  assert.notEqual(digest(), before);
  fs.writeFileSync(path.join(root, 'test/a.js'), 'assertions');
  assert.equal(digest(), before);
  fs.writeFileSync(path.join(root, 'test/b.js'), 'extra test');
  assert.notEqual(digest(), before);
  fs.rmSync(path.join(root, 'test/a.js'));
  assert.notEqual(digest(), before);
  fs.rmSync(path.join(root, 'page.html'));
  assert.throws(digest, /ENOENT/);
});

test('failures, skips, flaky results, empty reports and input races cannot publish proof', (t) => {
  const { receipt, digest } = fixture(t);
  const before = digest();
  for (const [report, status, after] of [
    [passed, 1, before],
    [passed, null, before],
    [passed, 0, 'changed'],
    [null, 0, before],
    [{ errors: [], stats: { ...passed.stats, expected: 0 } }, 0, before],
    ...['unexpected', 'skipped', 'flaky'].map((key) => [
      { errors: [], stats: { ...passed.stats, [key]: 1 } },
      0,
      before,
    ]),
    [{ ...passed, errors: ['global error'] }, 0, before],
  ]) {
    const id = beginProof(receipt);
    assert.equal(finishProof(receipt, id, { before, after, report, status }), false);
    assert.equal(canReuse(receipt, before), false);
  }
  assert.equal(completePass(passed), true);
});

test('a new run invalidates earlier success and a superseded run cannot restore it', (t) => {
  const { receipt, digest } = fixture(t);
  const before = digest();
  const first = beginProof(receipt);
  finishProof(receipt, first, { before, after: before, report: passed, status: 0 });
  assert.equal(canReuse(receipt, before), true);
  const second = beginProof(receipt);
  assert.equal(canReuse(receipt, before), false);
  finishProof(receipt, second, { before, after: before, report: passed, status: 1 });
  assert.equal(
    finishProof(receipt, first, { before, after: before, report: passed, status: 0 }),
    false,
  );
  assert.equal(canReuse(receipt, before), false);
  fs.writeFileSync(receipt, 'broken JSON');
  assert.equal(canReuse(receipt, before), false);
});
