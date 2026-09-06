import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./revision-fixture.mjs', import.meta.url));

function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omarchy-ci-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixtureEnvironment(root, inherited = process.env) {
  const env = Object.fromEntries(
    Object.entries(inherited).filter(([key]) => !/^(?:GIT|HK)_/.test(key)),
  );
  const template = path.join(root, 'empty-template');
  fs.mkdirSync(template, { recursive: true });
  const isolated = {
    ...env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TEMPLATE_DIR: template,
  };
  // Validate before even sentinel setup can invoke a mutating Git command.
  assert.deepEqual(
    Object.keys(isolated)
      .filter((key) => key.startsWith('GIT_'))
      .sort(),
    ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_TEMPLATE_DIR'],
  );
  assert.equal(
    Object.keys(isolated).some((key) => key.startsWith('HK_')),
    false,
  );
  return isolated;
}

function runFixture(root, inherited) {
  const output = execFileSync(process.execPath, [fixture, root], {
    cwd: root,
    env: fixtureEnvironment(root, inherited),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(output.trim(), 'revision fixture passed');
}

function snapshot(root) {
  return fs
    .readdirSync(root, { recursive: true })
    .sort()
    .flatMap((name) => {
      const file = path.join(root, name);
      const stat = fs.lstatSync(file);
      if (stat.isDirectory()) return [];
      return [[name, stat.mode, fs.readFileSync(file).toString('base64')]];
    });
}

function sentinelRepository(root) {
  const cwd = path.join(root, 'outer');
  fs.mkdirSync(cwd);
  const env = fixtureEnvironment(root);
  const git = (...args) => execFileSync('git', args, { cwd, env, stdio: 'pipe' });
  git('init', '-b', 'sentinel');
  assert.equal(git('rev-parse', '--show-toplevel').toString().trim(), fs.realpathSync(cwd));
  git('config', 'user.name', 'Sentinel fixture');
  git('config', 'user.email', 'sentinel@example.invalid');
  fs.writeFileSync(path.join(cwd, 'tracked'), 'committed\n');
  git('add', 'tracked');
  git('commit', '-m', 'sentinel baseline');
  fs.writeFileSync(path.join(cwd, 'tracked'), 'staged\n');
  git('add', 'tracked');
  fs.writeFileSync(path.join(cwd, 'tracked'), 'unstaged\n');
  fs.writeFileSync(path.join(cwd, 'untracked'), 'preserve\n');
  const hooks = path.join(cwd, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  fs.writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\nexit 97\n', { mode: 0o755 });
  const config = path.join(root, 'hostile-global.config');
  fs.writeFileSync(config, `[core]\n hooksPath = ${hooks}\n[commit]\n gpgsign = true\n`);
  return { cwd, hooks, config };
}

test('revision discovery handles divergent branches, renames, whitespace and failed refs', (t) => {
  runFixture(sandbox(t));
});

test('simulated hook context cannot change a sentinel outer HEAD, index, config or files', (t) => {
  const root = sandbox(t);
  const outer = sentinelRepository(root);
  const before = snapshot(outer.cwd);
  const configBefore = fs.readFileSync(outer.config);
  const child = path.join(root, 'child');
  fs.mkdirSync(child);
  runFixture(child, {
    ...process.env,
    GIT_DIR: path.join(outer.cwd, '.git'),
    GIT_COMMON_DIR: path.join(outer.cwd, '.git'),
    GIT_WORK_TREE: outer.cwd,
    GIT_INDEX_FILE: path.join(outer.cwd, '.git', 'index'),
    GIT_OBJECT_DIRECTORY: path.join(outer.cwd, '.git', 'objects'),
    GIT_CONFIG_GLOBAL: outer.config,
    GIT_CONFIG_SYSTEM: outer.config,
    GIT_TEMPLATE_DIR: outer.hooks,
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'core.worktree',
    GIT_CONFIG_VALUE_0: outer.cwd,
    GIT_CONFIG_KEY_1: 'commit.gpgsign',
    GIT_CONFIG_VALUE_1: 'true',
    GIT_AUTHOR_NAME: 'Inherited hook author',
    HK_CWD: outer.cwd,
    HK_FILE: path.join(outer.cwd, 'hk.pkl'),
  });
  assert.deepEqual(snapshot(outer.cwd), before);
  assert.deepEqual(fs.readFileSync(outer.config), configBefore);
});
