import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, inline } from '../../build/build.mjs';
import * as content from '../../src/content/index.js';

const MAX_BYTES = 1.2 * 1024 * 1024;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omarchy-build-'));
const out = path.join(dir, 'index.html');
await build(out);
const html = fs.readFileSync(out, 'utf8');

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('every template marker was filled in', () => {
  assert.ok(!html.includes('/*{{'), 'an unreplaced marker is left in the output');
});

test('the canvas, the loader and the hint pill are still there', () => {
  assert.ok(html.includes('id="gl"'));
  assert.ok(html.includes('id="loader"'));
  assert.ok(html.includes('id="hint"'));
  assert.ok(html.includes('id="fallback"'));
  assert.ok(html.includes('class="sr"'));
});

test('the module script keeps its try/catch fallback', () => {
  assert.ok(html.includes('<script type="module">'));
  assert.ok(html.includes("document.body.classList.add('failed')"));
});

test('the 14 fallback links are in the plain HTML', () => {
  for (const entry of content.menu) {
    assert.ok(html.includes(`href="${entry.url}"`), `${entry.label} link is missing`);
  }
  const nav = html.slice(html.indexOf('<div id="fallback">'), html.indexOf('<div class="sr">'));
  assert.equal(nav.match(/<a href="http/g).length, 14);
});

test('the assets are inlined as base64', () => {
  assert.ok(html.includes('window.__OM_RES__'));
  assert.ok(html.includes('data:image/webp;base64,'));
  assert.ok(/"chargen":"[A-Za-z0-9+/]+=*"/.test(html), 'the character ROM is missing');
});

test('the stylesheet was inlined, not linked', () => {
  assert.ok(html.includes('#hint.on'), 'the hint pill rule is missing');
  assert.ok(html.includes('body.ready #gl'), 'the reveal rule is missing');
  assert.ok(!html.includes('<link rel="stylesheet"'));
});

test('there is no runtime code loading left', () => {
  assert.ok(!html.includes('three-src'));
  assert.ok(!html.includes('createObjectURL'));
});

test(`the page is a single file under ${(MAX_BYTES / 1024 / 1024).toFixed(1)} MB`, () => {
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < MAX_BYTES, `${(bytes / 1024).toFixed(0)} kB is too big`);
  assert.ok(bytes > 300 * 1024, 'suspiciously small: did the bundle make it in?');
});

test('a missing marker fails the build loudly', () => {
  assert.equal(inline('a/*{{X}}*/b', 'X', 'Q'), 'aQb');
  assert.throws(() => inline('no marker here', 'APP', 'x'), /missing the/);
});
