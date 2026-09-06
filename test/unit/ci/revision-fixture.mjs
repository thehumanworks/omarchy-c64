// Runs only as a child of revisions.test.js, with a hermetic fixture environment.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { changedFiles, planForRevision } from '../../../scripts/ci/select.mjs';

const allowed = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_TEMPLATE_DIR'];
assert.deepEqual(
  Object.keys(process.env)
    .filter((key) => key.startsWith('GIT_'))
    .sort(),
  allowed,
);
assert.equal(
  Object.keys(process.env).some((key) => key.startsWith('HK_')),
  false,
);
assert.equal(process.env.GIT_CONFIG_GLOBAL, '/dev/null');
assert.equal(process.env.GIT_CONFIG_NOSYSTEM, '1');
const cwd = path.join(process.argv[2], 'repo');
fs.mkdirSync(cwd);
const git = (...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (file, value = file) => {
  const dest = path.join(cwd, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, value);
};
git('init', '-b', 'main');
assert.equal(git('rev-parse', '--show-toplevel'), fs.realpathSync(cwd));
git('config', 'user.email', 'ci-test@example.invalid');
git('config', 'user.name', 'CI fixture');
git('config', 'commit.gpgsign', 'false');
write('README.md');
write('src/main.js');
write('src/keep.js');
git('add', '.');
git('commit', '-m', 'base');
const base = git('rev-parse', 'HEAD');
git('switch', '-c', 'topic');
write('docs/CHANGE.md');
git('add', '.');
git('commit', '-m', 'docs');
assert.deepEqual(changedFiles(base, cwd), ['docs/CHANGE.md']);
assert.equal(planForRevision(base, cwd).build, false);
git('switch', 'main');
write('src/other.js');
git('add', '.');
git('commit', '-m', 'unrelated upstream change');
git('switch', 'topic');
assert.deepEqual(changedFiles('main', cwd), ['docs/CHANGE.md']);
assert.deepEqual(changedFiles('main', cwd, 'push').sort(), ['docs/CHANGE.md', 'src/other.js']);
assert.equal(planForRevision('main', cwd, 'push').mode, 'full');
git('mv', 'src/main.js', 'docs/MOVED.md');
write(' docs/space.md');
git('add', '.');
git('commit', '-m', 'rename and whitespace');
const files = changedFiles(base, cwd);
assert.ok(files.includes('src/main.js'));
assert.ok(files.includes('docs/MOVED.md'));
assert.ok(files.includes(' docs/space.md'));
assert.equal(planForRevision(base, cwd).mode, 'full');
for (const ref of ['', '0000000000', 'missing-ref', '--help']) {
  assert.equal(planForRevision(ref, cwd).mode, 'full', ref);
}
git('merge', '--no-ff', 'main', '-m', 'merge upstream');
assert.ok(changedFiles(base, cwd, 'push').includes('src/other.js'));
assert.ok(!changedFiles('main', cwd).includes('src/other.js'));
assert.equal(planForRevision('HEAD', cwd).mode, 'full');
write('src/dirty.js');
write('README.md', 'modified tracked document');
assert.ok(changedFiles('HEAD', cwd).includes('src/dirty.js'));
assert.ok(changedFiles('HEAD', cwd).includes('README.md'));
assert.equal(planForRevision('HEAD', cwd).mode, 'full');
assert.equal(planForRevision(base, cwd, 'unknown-mode').mode, 'full');
assert.equal(planForRevision(base, path.join(cwd, 'absent')).mode, 'full');
console.log('revision fixture passed');
