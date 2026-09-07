// Local proof is reusable only for identical browser inputs and a complete pass.
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const INPUTS = [
  'src',
  'content',
  'site',
  'assets',
  'vendor',
  'build',
  'test',
  'scripts',
  'dist/index.html',
  'package.json',
  'package-lock.json',
  'playwright.config.js',
  'mise.toml',
  'mise.lock',
  'node_modules/.package-lock.json',
  'node_modules/playwright-core/browsers.json',
];
const MAX_AGE = 24 * 60 * 60 * 1000;

export function fingerprint(root, context, inputs = INPUTS) {
  const hash = createHash('sha256').update(JSON.stringify(context));
  function visit(name) {
    const file = path.join(root, name);
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(file).sort()) visit(`${name}/${child}`);
    } else {
      if (!stat.isFile()) throw new Error(`Unsupported browser input: ${name}`);
      hash.update(JSON.stringify(name)).update('\0').update(fs.readFileSync(file)).update('\0');
    }
  }
  for (const name of inputs) visit(name);
  return hash.digest('hex');
}

export function readProof(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeProof(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`);
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function completePass(report) {
  const stats = report?.stats;
  return (
    Array.isArray(report?.errors) &&
    report.errors.length === 0 &&
    Number.isInteger(stats?.expected) &&
    stats.expected > 0 &&
    ['unexpected', 'skipped', 'flaky'].every((key) => stats[key] === 0)
  );
}

export function canReuse(file, digest, now = Date.now()) {
  const current = readProof(file);
  const proof = readProof(`${file}.result`);
  const age = now - proof?.at;
  return (
    current?.runId === proof?.runId &&
    !!current?.runId &&
    proof?.version === 1 &&
    proof.state === 'passed' &&
    proof.fingerprint === digest &&
    age >= 0 &&
    age < MAX_AGE &&
    completePass(proof.report)
  );
}

// Starting a fresh run invalidates earlier success. A superseded run cannot
// overwrite a newer failure, even when two commands accidentally overlap.
export function beginProof(file) {
  const runId = randomUUID();
  writeProof(file, { state: 'running', runId });
  return runId;
}

export function finishProof(file, runId, { before, after, report, status }) {
  if (readProof(file)?.runId !== runId) return false;
  if (status !== 0 || before !== after || !completePass(report)) {
    writeProof(`${file}.result`, { state: 'failed', runId });
    return false;
  }
  writeProof(`${file}.result`, {
    version: 1,
    state: 'passed',
    runId,
    fingerprint: after,
    at: Date.now(),
    report: { stats: report.stats, errors: [] },
  });
  return true;
}
