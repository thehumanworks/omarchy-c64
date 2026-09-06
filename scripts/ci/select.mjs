import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function fullPlan(reason = 'Shared or unknown input changed') {
  return { mode: 'full', reason, unit: true, build: true, e2e: ['all'], freshness: true };
}

const docs =
  /^(?:docs\/.*\.md|(?:README|CONTRIBUTING|AGENTS)\.md|test\/e2e\/README\.md|vendor\/README\.md)$/;
const sync =
  /^(?:scripts\/sync\/.*\.mjs|scripts\/sync-content\.mjs)$|^test\/(?:fixtures|unit)\/sync\//;
export const CURSOR_SUITES = [
  'boot',
  'fallback',
  'cursor',
  'pointer',
  'touch',
  'monitor-controls',
  'visual',
  'orientation',
].map((name) => `test/e2e/${name}.spec.js`);

const spec = /^test\/e2e\/[a-z0-9-]+\.spec\.js$/;

export function selectChecks(files, exists = existsSync) {
  if (!files?.length) return fullPlan('No trustworthy changed-file list');
  const plan = {
    mode: 'affected',
    reason: 'Only isolated inputs changed',
    unit: false,
    build: false,
    e2e: [],
    freshness: false,
  };
  for (const file of files) {
    if (docs.test(file)) continue;
    if (file === 'src/input/cursor.js' && exists(file) && CURSOR_SUITES.every(exists)) {
      plan.unit = true;
      plan.build = true;
      plan.e2e.push(...CURSOR_SUITES);
    } else if (sync.test(file)) {
      plan.unit = true;
      plan.freshness = true;
    } else if (/^test\/unit\/.*\.test\.js$/.test(file)) {
      plan.unit = true;
    } else if (spec.test(file) && exists(file)) {
      plan.build = true;
      plan.e2e.push(file);
    } else {
      return fullPlan(`Shared or unknown input: ${file}`);
    }
  }
  plan.e2e = [...new Set(plan.e2e)].sort();
  return plan;
}

export function changedFiles(base, cwd = process.cwd(), comparison = 'merge-base') {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!base || /^0+$/.test(base)) throw new Error('Missing base revision');
  const resolved = git('rev-parse', '--verify', '--end-of-options', `${base}^{commit}`).trim();
  const head = git('rev-parse', '--verify', 'HEAD').trim();
  if (!['merge-base', 'push'].includes(comparison)) throw new Error('Unknown comparison');
  const ancestor = comparison === 'push' ? resolved : git('merge-base', resolved, head).trim();
  // --no-renames includes both old and new paths, so moving runtime code into
  // an otherwise isolated directory can never hide its original impact.
  const committed = git('diff', '--name-only', '-z', '--no-renames', ancestor, head, '--');
  const working = git('diff', '--name-only', '-z', '--no-renames', head, '--');
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z');
  return [...new Set((committed + working + untracked).split('\0').filter(Boolean))];
}

export function planForRevision(base, cwd = process.cwd(), comparison = 'merge-base') {
  try {
    return selectChecks(changedFiles(base, cwd, comparison), (file) =>
      existsSync(path.join(cwd, file)),
    );
  } catch {
    return fullPlan('Base revision or changed-file discovery failed');
  }
}
