// Benchmark representative change classes through the same command planner.
// This does not modify the repository or waive the actual revision-based gate.
import { performance } from 'node:perf_hooks';
import { selectChecks, fullPlan } from './select.mjs';
import { runChecks } from './checks.mjs';

const scenarios = {
  full: () => fullPlan('Benchmark full gate'),
  docs: () => selectChecks(['docs/DEVELOPMENT.md']),
  spec: () => selectChecks(['test/e2e/cursor.spec.js']),
  cursor: () => selectChecks(['src/input/cursor.js']),
};
const scenario = process.argv[2];
if (!Object.hasOwn(scenarios, scenario))
  throw new Error('Usage: benchmark.mjs full|docs|spec|cursor');
const plan = scenarios[scenario]();
console.log(JSON.stringify({ scenario, plan }, null, 2));
const started = performance.now();
const exitCode = runChecks(plan);
console.log(JSON.stringify({ scenario, seconds: (performance.now() - started) / 1000, exitCode }));
process.exitCode = exitCode;
