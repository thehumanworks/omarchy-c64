import test from 'node:test';
import assert from 'node:assert/strict';
import { nodesFromFeed, formatDate, fetchNodes } from '../../../scripts/sync/adapters/feed.mjs';
import { fixture, stubDeps } from './helpers.js';

const NEWS = {
  url: 'https://omarchy.org/news/rss.xml',
  title: 'OMARCHY NEWS',
  lead: 'Announcements, releases, and other news',
  dateLabel: 'Date',
  readMore: 'Read more',
};

test('an item becomes H3 title, KV Date, P summary, A Read more', () => {
  const { nodes } = nodesFromFeed(fixture('news.rss.xml'), NEWS);
  assert.deepEqual(nodes.slice(0, 5), [
    ['H2', 'Announcements, releases, and other news'],
    ['H3', 'Omacom Foundation secures $1.95M in tokens'],
    ['KV', 'Date', 'September 3, 2026'],
    ['P', 'Meta Superintelligence Labs joins as Founding Token Patron.'],
    ['A', 'Read more', 'https://omarchy.org/news/2026/09/tokens'],
  ]);
});

test('CDATA is unwrapped and the summary markup is stripped to text', () => {
  const { nodes } = nodesFromFeed(fixture('news.rss.xml'), NEWS);
  const summaries = nodes.filter((n) => n[0] === 'P').map((n) => n[1]);
  assert.ok(!summaries.join(' ').includes('<p>'));
  assert.ok(!summaries.join(' ').includes('deliberately ignore'), 'content:encoded is not used');
});

test('every item is emitted, in feed order', () => {
  const { nodes } = nodesFromFeed(fixture('news.rss.xml'), NEWS);
  assert.deepEqual(
    nodes.filter((n) => n[0] === 'H3').map((n) => n[1]),
    ['Omacom Foundation secures $1.95M in tokens', 'The first plugin competition winners'],
  );
});

test('limit truncates the list', () => {
  const { nodes } = nodesFromFeed(fixture('news.rss.xml'), { ...NEWS, limit: 1 });
  assert.equal(nodes.filter((n) => n[0] === 'H3').length, 1);
});

test('RFC 822 and ISO dates both print the way the site does', () => {
  assert.equal(formatDate('Wed, 03 Sep 2026 15:45:00 -0400'), 'September 3, 2026');
  assert.equal(formatDate('2026-08-28T09:00:00Z'), 'August 28, 2026');
  assert.equal(formatDate('not a date'), 'not a date', 'garbage passes through, it does not throw');
});

test('atom entries use the link element href', () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>F</title><entry>
    <title>Hello</title><link rel="alternate" href="https://omarchy.org/news/x"/>
    <published>2026-08-01T00:00:00Z</published><summary>A summary.</summary>
  </entry></feed>`;
  const { nodes } = nodesFromFeed(atom, { readMore: 'Read more' });
  assert.deepEqual(nodes, [
    ['H3', 'Hello'],
    ['KV', 'Date', 'August 1, 2026'],
    ['P', 'A summary.'],
    ['A', 'Read more', 'https://omarchy.org/news/x'],
  ]);
});

test('fetchNodes reads the feed through deps', async () => {
  const deps = stubDeps({ 'rss.xml': fixture('news.rss.xml') });
  const { title, nodes } = await fetchNodes(NEWS, deps);
  assert.equal(title, 'OMARCHY NEWS');
  assert.ok(nodes.length > 5);
});
