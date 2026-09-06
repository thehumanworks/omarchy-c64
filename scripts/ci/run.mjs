import { readPlan, publishPlan } from './plan.mjs';
import { runChecks } from './checks.mjs';

const plan = readPlan();
publishPlan(plan);
process.exitCode = runChecks(plan);
