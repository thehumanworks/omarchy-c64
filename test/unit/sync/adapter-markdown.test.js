import test from 'node:test';
import assert from 'node:assert/strict';
import { nodesFromMarkdown, frontMatter, inlineText } from '../../../scripts/sync/markdown.mjs';
import { chapterTitle, fetchNodes } from '../../../scripts/sync/adapters/github-markdown.mjs';
import { fixture, stubDeps, kinds } from './helpers.js';

const MANUAL = {
  url: 'https://omarchy.org/manual/',
  title: 'THE OMARCHY MANUAL',
  repo: 'omacom/omarchy',
  branch: 'quattro',
  dir: 'manual',
  lede: '01-welcome-to-omarchy.md',
  contentsHeading: 'Contents',
  readMore: 'Read the full manual',
};

test('YAML front matter is split off, not printed', () => {
  const { meta, body } = frontMatter(fixture('manual-01.md'));
  assert.equal(meta.title, 'Welcome to Omarchy!');
  assert.ok(body.trimStart().startsWith('# Welcome'));
});

test('inline markdown flattens to the label, dropping the URL and emphasis', () => {
  assert.equal(inlineText('an [omakase](https://x.test) distro'), 'an omakase distro');
  assert.equal(inlineText('**bold** and `code`'), 'bold and code');
  assert.equal(inlineText('![alt](img.png)shown'), 'shown');
});

test('headings, paragraphs, bullets and tables map onto the node model', () => {
  const nodes = nodesFromMarkdown(fixture('manual-01.md'), { links: false });
  assert.deepEqual(nodes[0], ['H2', 'Welcome to Omarchy!']);
  assert.ok(nodes.some((n) => n[0] === 'H3' && n[1] === 'Not a chapter heading'));
  assert.deepEqual(kinds(nodes, 'LI'), [['First bullet'], ['Second bullet']]);
  assert.deepEqual(kinds(nodes, 'KV'), [
    ['Key', 'Action'],
    ['Super + Enter', 'Terminal'],
  ]);
});

test('fenced code is dropped: a 40-column screen has no use for it', () => {
  const nodes = nodesFromMarkdown(fixture('manual-01.md'), { links: false });
  assert.ok(!JSON.stringify(nodes).includes('code fences are dropped'));
});

test('a hard-wrapped paragraph is rejoined into one P node', () => {
  assert.deepEqual(nodesFromMarkdown('Line one\nline two.\n', { links: false }), [
    ['P', 'Line one line two.'],
  ]);
  assert.deepEqual(nodesFromMarkdown('One.\n\nTwo.\n', { links: false }), [
    ['P', 'One.'],
    ['P', 'Two.'],
  ]);
});

test('links: false suppresses A nodes so the manual prose stays readable', () => {
  const withLinks = nodesFromMarkdown(fixture('manual-01.md'), { links: true });
  const without = nodesFromMarkdown(fixture('manual-01.md'), { links: false });
  assert.ok(withLinks.some((n) => n[0] === 'A'));
  assert.ok(!without.some((n) => n[0] === 'A'));
});

test('a chapter title comes from its H1, or its filename as a fallback', () => {
  assert.equal(
    chapterTitle('# Getting Started\n\ntext', '02-getting-started.md'),
    'Getting Started',
  );
  assert.equal(chapterTitle('no heading here', '07-the-top-bar.md'), 'the top bar');
});

test('the manual page is the lede prose, a Contents list, then one link out', async () => {
  const deps = stubDeps({
    'api.github.com/repos/omacom/omarchy/contents/manual': [
      { type: 'file', name: '02-getting-started.md', path: 'manual/02-getting-started.md' },
      { type: 'file', name: '01-welcome-to-omarchy.md', path: 'manual/01-welcome-to-omarchy.md' },
      { type: 'dir', name: 'images', path: 'manual/images' },
    ],
    'api.github.com/repos/omacom/omarchy': { default_branch: 'quattro' },
    '01-welcome-to-omarchy.md': fixture('manual-01.md'),
    '02-getting-started.md': '# Getting Started\n\nInstall it.\n',
  });
  const { title, nodes } = await fetchNodes(MANUAL, deps);

  assert.equal(title, 'THE OMARCHY MANUAL');
  assert.deepEqual(nodes[0], ['H2', 'Welcome to Omarchy!']);
  const contents = nodes.findIndex((n) => n[0] === 'H2' && n[1] === 'Contents');
  assert.ok(contents > 0, 'the Contents heading follows the lede prose');
  assert.deepEqual(nodes.slice(contents + 1, contents + 3), [
    ['LI', 'Welcome to Omarchy!'],
    ['LI', 'Getting Started'],
  ]);
  assert.deepEqual(nodes.at(-1), ['A', 'Read the full manual', 'https://omarchy.org/manual/']);
  assert.ok(
    !nodes.slice(0, contents).some((n) => n[0] === 'A'),
    'the lede prose carries no inline links',
  );
});

test('chapters are ordered by their NN- filename prefix, not by API order', async () => {
  const deps = stubDeps({
    'contents/manual': [
      { type: 'file', name: '10-later.md', path: 'manual/10-later.md' },
      { type: 'file', name: '02-second.md', path: 'manual/02-second.md' },
      { type: 'file', name: '01-welcome-to-omarchy.md', path: 'manual/01-welcome-to-omarchy.md' },
    ],
    'api.github.com/repos/omacom/omarchy': { default_branch: 'quattro' },
    '01-welcome-to-omarchy.md': '# One\n\nText.\n',
    '02-second.md': '# Two\n',
    '10-later.md': '# Ten\n',
  });
  const { nodes } = await fetchNodes(MANUAL, deps);
  assert.deepEqual(kinds(nodes, 'LI'), [['One'], ['Two'], ['Ten']]);
});

test('an empty chapter directory fails rather than emptying the page', async () => {
  const deps = stubDeps({
    'contents/manual': [],
    'api.github.com/repos/omacom/omarchy': { default_branch: 'quattro' },
  });
  await assert.rejects(() => fetchNodes(MANUAL, deps), /no chapters/);
});
