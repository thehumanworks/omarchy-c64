// CI builds once, then isolated browser runners consume that exact artifact.
import fs from 'node:fs';
import path from 'node:path';
import { readPlan, publishPlan } from './plan.mjs';
import { runChecks } from './checks.mjs';

const planFile = '.cache/verification/plan.json';
const [phase, ...args] = process.argv.slice(2);
if (phase === 'fast') {
  const plan = readPlan(args);
  publishPlan(plan);
  fs.mkdirSync(path.dirname(planFile), { recursive: true });
  fs.writeFileSync(planFile, `${JSON.stringify(plan)}\n`);
  process.exitCode = runChecks(plan, undefined, { phase: 'fast' });
} else if (phase === 'browser' && args.length === 2 && args[0] === '--shard') {
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  if (!plan.build || !Array.isArray(plan.e2e) || !plan.e2e.length)
    throw new Error('Browser verification requires a built artifact and a nonempty plan');
  if (!fs.statSync('dist/index.html').isFile()) throw new Error('Missing built artifact');
  process.exitCode = runChecks(plan, undefined, { phase: 'browser', shard: args[1] });
} else {
  throw new Error('Usage: stage.mjs fast [revision options] | browser --shard N/T');
}
