import { spawnSync } from 'node:child_process';

export function commandsFor(plan) {
  const commands = [
    ['run', 'lint'],
    ['run', 'format:check'],
  ];
  if (plan.unit) commands.push(['run', 'test:unit']);
  if (plan.build) {
    commands.push(['run', 'test:build'], ['run', 'build']);
  }
  if (plan.e2e.length) {
    const specs = plan.e2e.includes('all') ? [] : ['--', ...plan.e2e];
    commands.push(['run', 'test:e2e', ...specs]);
  }
  return commands;
}

export function runChecks(plan, execute = spawnSync) {
  for (const args of commandsFor(plan)) {
    const result = execute('npm', args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status || 1;
  }
  return 0;
}
