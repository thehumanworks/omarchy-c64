import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const runner = path.join(repository, 'scripts/ci/browser-check.mjs');

test('real Playwright proof is reused only after a full pass and invalidated by partial/failed runs', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omarchy-browser-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of [
    'src',
    'content',
    'site',
    'assets',
    'vendor',
    'build',
    'test/e2e',
    'scripts/ci',
    'dist',
  ])
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  for (const file of ['package-lock.json', 'mise.toml', 'mise.lock'])
    fs.writeFileSync(path.join(root, file), '');
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  fs.symlinkSync(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  // This fixture uses real Playwright test/reporting, but no browser fixture.
  // Give fingerprinting a local identity so the fast CI job needs no Chromium.
  const env = { ...process.env, CI: '', PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'browsers') };
  const identity = spawnSync(
    process.execPath,
    ['-e', "process.stdout.write(require('@playwright/test').chromium.executablePath())"],
    { cwd: root, env, encoding: 'utf8', timeout: 30_000 },
  );
  assert.equal(identity.status, 0, identity.stderr);
  fs.mkdirSync(path.dirname(identity.stdout), { recursive: true });
  fs.writeFileSync(identity.stdout, 'browser identity fixture, never executed');
  fs.writeFileSync(
    path.join(root, 'playwright.config.js'),
    'export default {testDir:"./test/e2e",reporter:[["list"]]};',
  );
  fs.writeFileSync(path.join(root, 'dist/index.html'), 'fixture page');
  const spec = path.join(root, 'test/e2e/proof.spec.js');
  const source = `import {test,expect} from '@playwright/test';
import {appendFileSync} from 'node:fs';
test('proof fixture',()=>{appendFileSync('executions','x');expect(1).toBe(1);});`;
  fs.writeFileSync(spec, source);
  const run = (...args) => {
    const result = spawnSync(process.execPath, [runner, ...args], {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.error, undefined, result.error?.message);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  const calls = () => fs.readFileSync(path.join(root, 'executions'), 'utf8').length;
  let result = run();
  assert.equal(result.status, 0, result.output);
  result = run('--reuse');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /proof reused/);
  assert.equal(calls(), 1);
  fs.writeFileSync(path.join(root, 'dist/index.html'), 'different fixture page');
  result = run('--reuse');
  assert.equal(result.status, 0, result.output);
  assert.equal(calls(), 2, 'changed artifact must run tests');
  result = run('--grep', 'proof fixture');
  assert.equal(result.status, 0, result.output);
  result = run('--reuse');
  assert.equal(result.status, 0, result.output);
  assert.equal(calls(), 4, 'a filtered pass cannot replace complete proof');
  fs.writeFileSync(spec, source.replace('toBe(1)', 'toBe(2)'));
  assert.notEqual(run().status, 0);
  fs.writeFileSync(spec, source);
  result = run('--reuse');
  assert.equal(result.status, 0, result.output);
  assert.equal(calls(), 6, 'a failed run invalidates even an older matching pass');
});
