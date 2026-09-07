import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from '@playwright/test';
import { beginProof, canReuse, fingerprint, finishProof, readProof } from './browser-proof.mjs';

const root = process.cwd();
const receipt = path.join(root, '.cache/verification/browser.json');
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');

function signature() {
  const executable = chromium.executablePath();
  const binary = fs.statSync(executable);
  const env = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => /^(CI$|NODE_OPTIONS$|NODE_ENV$|TZ$|LANG$|PLAYWRIGHT_|PW_)/.test(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return fingerprint(root, {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    executable,
    bytes: binary.size,
    modified: binary.mtimeMs,
    env,
  });
}

function execute(args, env = process.env) {
  const result = spawnSync(process.execPath, [cli, 'test', ...args], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main(args) {
  const reuse = args.length === 1 && args[0] === '--reuse';
  if (args.includes('--reuse') && !reuse) throw new Error('--reuse cannot filter browser tests');
  if (args.length && !reuse) {
    beginProof(receipt); // A partial, filtered or snapshot-update run never supplies full proof.
    return execute(args);
  }
  const before = signature();
  const lastRun = readProof(path.join(root, 'test-results/.last-run.json'));
  const lastRunPassed = lastRun?.status === 'passed' && lastRun.failedTests?.length === 0;
  if (reuse && !process.env.CI && lastRunPassed && canReuse(receipt, before)) {
    console.log('Browser proof reused: identical inputs, complete pass within 24 hours.');
    return 0;
  }
  const runId = beginProof(receipt);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omarchy-browser-report-'));
  const reportPath = path.join(temporary, 'report.json');
  try {
    const status = execute(['--forbid-only', '--update-snapshots=none', '--add-reporter=json'], {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
    });
    const saved = finishProof(receipt, runId, {
      before,
      after: signature(),
      report: readProof(reportPath),
      status,
    });
    if (status !== 0) return status;
    if (!saved)
      throw new Error('Browser proof incomplete or inputs changed during the run; rerun.');
    console.log('Complete browser proof recorded for these exact inputs.');
    return 0;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
