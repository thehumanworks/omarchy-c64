import { appendFileSync } from 'node:fs';
import { fullPlan, planForRevision } from './select.mjs';

export function readPlan(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--full') return fullPlan('Full verification requested');
  if (argv.length === 2 && argv[0] === '--base') return planForRevision(argv[1]);
  if (argv.length === 2 && argv[0] === '--push-base')
    return planForRevision(argv[1], process.cwd(), 'push');
  if (!argv.length) return fullPlan('No base supplied');
  throw new Error('Usage: --full | --base REVISION | --push-base REVISION');
}

export function publishPlan(plan) {
  console.log(JSON.stringify(plan, null, 2));
  if (!process.env.GITHUB_OUTPUT) return;
  const outputs = {
    build: plan.build,
    browser: plan.e2e.length > 0,
  };
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
}
