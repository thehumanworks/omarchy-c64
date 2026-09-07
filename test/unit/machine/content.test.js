import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as content from '../../../src/content/index.js';

const { menu, pages, shortcuts, strings } = content;

const CURLY = /[“”‘’]/;
const LOWER = /[a-z]/;

test('every committed page is registered once under its filename and menu key', () => {
  const directory = new URL('../../../content/pages/', import.meta.url);
  const files = readdirSync(directory).filter((name) => name.endsWith('.json'));
  const keys = files.map((name) => {
    const page = JSON.parse(readFileSync(new URL(name, directory), 'utf8'));
    assert.equal(name, `${page.key.toLowerCase()}.json`);
    return page.key;
  });
  assert.equal(new Set(keys).size, keys.length, 'duplicate page key');
  assert.deepEqual(
    Object.keys(pages).sort(),
    keys.sort(),
    'update PAGE_FILES in src/content/index.js',
  );
});

/** Every piece of text a page node carries (never the kind, never a URL). */
function nodeTexts(node) {
  return node.slice(1).filter((_, i) => !(node[0] === 'A' && i === 1));
}

test('the menu has 14 entries with a label, an http url and a block count', () => {
  assert.equal(menu.length, 14);
  for (const e of menu) {
    assert.ok(e.label.length > 0);
    assert.ok(!LOWER.test(e.label), `${e.label} is not upper case`);
    assert.match(e.url, /^https?:\/\//);
    assert.ok(Number.isInteger(e.blocks) && e.blocks > 0, `${e.label} has no block count`);
  }
  assert.equal(new Set(menu.map((e) => e.label)).size, 14);
});

test('every page is normalised: upper case, straight quotes', () => {
  for (const [key, page] of Object.entries(pages)) {
    assert.ok(!LOWER.test(page.title), `${key} title is not upper case`);
    assert.ok(!CURLY.test(page.title), `${key} title has curly quotes`);
    for (const node of page.nodes) {
      for (const text of nodeTexts(node)) {
        assert.ok(!LOWER.test(text), `${key}: lower case in ${JSON.stringify(text)}`);
        assert.ok(!CURLY.test(text), `${key}: curly quote in ${JSON.stringify(text)}`);
      }
    }
  }
});

test('every page node is a kind the renderer knows', () => {
  const KINDS = new Set(['H2', 'H3', 'P', 'LI', 'KV', 'A']);
  for (const [key, page] of Object.entries(pages)) {
    assert.ok(page.nodes.length > 0, `${key} is empty`);
    for (const node of page.nodes) {
      assert.ok(Array.isArray(node), `${key}: expected a node tuple`);
      assert.ok(KINDS.has(node[0]), `${key}: bad kind ${node[0]}`);
      assert.equal(
        node.length,
        ['KV', 'A'].includes(node[0]) ? 3 : 2,
        `${key}: malformed ${node[0]}`,
      );
      assert.ok(
        node.every((part) => typeof part === 'string'),
        `${key}: non-text tuple part`,
      );
    }
  }
});

test('every A node points somewhere real', () => {
  for (const [key, page] of Object.entries(pages)) {
    for (const node of page.nodes) {
      if (node[0] !== 'A') continue;
      assert.match(node[2], /^(https?:\/\/|mailto:)/, `${key}: ${node[2]}`);
      assert.ok(node[1].length > 0, `${key}: an A node with no label`);
    }
  }
});

test('a page file keys itself by the menu label that opens it', () => {
  const labels = new Set(menu.map((e) => e.label));
  for (const [key, page] of Object.entries(pages)) {
    assert.equal(page.key, key, 'the map key is the page key');
    assert.ok(labels.has(key), `${key} is not a menu label`);
    const entry = menu.find((e) => e.label === key);
    assert.equal(entry.url, page.url, `${key} url should match the menu`);
  }
});

test('nine of the fourteen entries open on the tube', () => {
  const first = menu.filter((e) => pages[e.label]);
  assert.equal(first.length, 9);
  assert.deepEqual(first.map((e) => e.label).sort(), [
    'AIR',
    'MANUAL',
    'MEETUPS',
    'NEWS',
    'PATRONS',
    'SECURITY',
    'SPONSORS',
    'TEAMS',
    'WORKSTATIONS',
  ]);
});

test('shortcuts are upper-case names pointing at real urls', () => {
  for (const [name, url] of Object.entries(shortcuts)) {
    assert.ok(!LOWER.test(name), `${name} is not upper case`);
    assert.match(url, /^(https?:\/\/|mailto:)/, `${name}: ${url}`);
  }
});

test('the editorial strings survived normalisation', () => {
  assert.ok(strings.ticker.startsWith('··· OMACOM FOUNDATION'));
  assert.ok(strings.ticker.endsWith('··· '));
  assert.equal(strings.chrome.title, ' OMARCHY/64 ');
  assert.equal(strings.help.commands.filter((c) => c === null).length, 1);
  assert.equal(strings.help.commands.filter(Boolean).length, 10);
  assert.equal(strings.about.lines.filter((l) => l === '').length, 3);
  for (const s of strings.hints) assert.ok(!LOWER.test(s), s);
});

// Issue #7: the tube talks about Omarchy, never about who hosts, builds or
// deploys this site. The chrome, the ABOUT page and the typed shortcuts are the
// places such a credit used to live.
test('the tube copy never credits the hosting or build stack', () => {
  const STACK = /CLOUDFLARE|HOSTING|HOSTED/;
  const copy = [
    strings.ticker,
    ...strings.hints,
    ...strings.about.lines.map((l) => (l === '' ? '' : l[0])),
    ...Object.keys(shortcuts),
  ];
  for (const text of copy) assert.doesNotMatch(text, STACK, text);
});
