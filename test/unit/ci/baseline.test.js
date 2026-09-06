import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedBaseline } from '../../../scripts/ci/baseline.mjs';

test('push selection requires successful verification of exactly the previous SHA', () => {
  const sha = 'a'.repeat(40);
  const good = { head_sha: sha, event: 'push', status: 'completed', conclusion: 'success' };
  assert.equal(hasVerifiedBaseline([good], sha), true);
  for (const patch of [
    { head_sha: 'b'.repeat(40) },
    { event: 'pull_request' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { conclusion: 'cancelled' },
    { conclusion: 'skipped' },
  ])
    assert.equal(hasVerifiedBaseline([{ ...good, ...patch }], sha), false);
  assert.equal(hasVerifiedBaseline([], sha), false);
  assert.equal(hasVerifiedBaseline([good], ''), false);
  assert.equal(hasVerifiedBaseline([good], '0'.repeat(40)), false);
});
