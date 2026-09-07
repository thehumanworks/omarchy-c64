import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { ESLint } from 'eslint';

const eslint = new ESLint();
const boundaryRule = 'import-x/no-restricted-paths';

test('lint rejects upward imports, browser siblings in pure maths, and raw content access', async () => {
  for (const [filePath, source] of [
    ['src/machine/state.js', "import '../input/keyboard.js';"],
    ['src/runtime/loop.js', "import '../main.js';"],
    ['src/scene/case.js', "import './hardware.js';"],
    ['src/screen/text-buffer.js', "import './painter.js';"],
    ['src/machine/state.js', "import '../../vendor/three.module.min.js';"],
    ['src/machine/state.js', "import '../screen/painter.js';"],
    ['src/machine/state.js', "import '../screen/logo.js';"],
    [
      'src/machine/state.js',
      "import data from '../../content/menu.json' with { type: 'json' }; void data;",
    ],
  ]) {
    const [result] = await eslint.lintText(source, { filePath });
    assert.ok(
      result.messages.some((m) => m.ruleId === boundaryRule),
      `${filePath}: ${source}`,
    );
  }
});

test('lint allows sibling and downward imports and main composition', async () => {
  for (const [filePath, source] of [
    ['src/machine/state.js', "import './doc-lines.js';"],
    ['src/machine/state.js', "import '../text/wrap.js';"],
    ['src/main.js', "import './runtime/links.js';"],
  ]) {
    const [result] = await eslint.lintText(source, { filePath });
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
  }
});

test('lint rejects DOM access in core functions, not just at import time', async () => {
  const [result] = await eslint.lintText('export const node = () => document.body;', {
    filePath: 'src/machine/navigate.js',
  });
  assert.ok(result.messages.some((m) => m.ruleId === 'no-restricted-globals'));
});

test('every core module imports in plain Node without a browser or WebGL setup', async () => {
  const root = new URL('../../src/', import.meta.url);
  const files = ['screen/text-buffer.js', 'screen/logo.js', 'scene/case.js'];
  for (const dir of ['content', 'text', 'machine', 'audio']) {
    for (const name of readdirSync(new URL(`${dir}/`, root), { recursive: true })) {
      if (name.endsWith('.js')) files.push(`${dir}/${name}`);
    }
  }
  for (const file of files) await import(new URL(file, root));
});
