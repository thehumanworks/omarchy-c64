import { spawnSync } from 'node:child_process';

function browserCommand(plan, shard) {
  const args = plan.e2e.includes('all') ? [] : [...plan.e2e];
  if (shard) {
    if (!/^[1-4]\/[1-4]$/.test(shard) || Number(shard[0]) > Number(shard[2]))
      throw new Error('Shard must be N/T with 1 <= N <= T <= 4');
    args.push('--fully-parallel', `--shard=${shard}`, '--forbid-only', '--update-snapshots=none');
  }
  return ['run', 'test:e2e', ...(args.length ? ['--', ...args] : [])];
}

export function commandsFor(plan, { phase = 'all', shard } = {}) {
  if (!['all', 'fast', 'browser'].includes(phase)) throw new Error('Unknown check phase');
  const commands =
    phase === 'browser'
      ? []
      : [
          ['run', 'lint'],
          ['run', 'format:check'],
        ];
  if (plan.unit && phase !== 'browser') commands.push(['run', 'test:unit']);
  if (plan.build && phase !== 'browser') {
    commands.push(['run', 'test:build'], ['run', 'build']);
  }
  if (plan.e2e.length && phase !== 'fast') {
    commands.push(browserCommand(plan, shard));
  }
  return commands;
}

export function runChecks(plan, execute = spawnSync, options) {
  for (const args of commandsFor(plan, options)) {
    const result = execute('npm', args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status || 1;
  }
  return 0;
}
