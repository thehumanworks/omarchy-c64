// A push range is safe only when its starting commit passed this same release
// workflow. Otherwise a previous failed/unrun change could escape selection.
export function hasVerifiedBaseline(runs, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha || '') || /^0+$/.test(sha)) return false;
  return runs.some(
    (run) =>
      run.head_sha === sha &&
      run.event === 'push' &&
      run.status === 'completed' &&
      run.conclusion === 'success',
  );
}
