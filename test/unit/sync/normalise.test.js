import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseText,
  decodeEntities,
  capLength,
  normaliseUrl,
  normaliseNodes,
} from '../../../scripts/sync/normalise.mjs';

test('decodes named and numeric entities', () => {
  assert.equal(decodeEntities('Tobi L&uuml;tke'), 'Tobi Lütke');
  assert.equal(decodeEntities('a &amp; b'), 'a & b');
  assert.equal(decodeEntities('&#8212;'), '—');
  assert.equal(decodeEntities('&#x2014;'), '—');
  assert.equal(decodeEntities('&notareal;'), '&notareal;', 'unknown entities are left alone');
});

test('collapses whitespace and trims', () => {
  assert.equal(normaliseText('  a\n\t b   c  '), 'a b c');
  assert.equal(normaliseText(''), '');
  assert.equal(normaliseText(null), '');
});

test('folds typography to straight ASCII the character ROM can draw', () => {
  assert.equal(normaliseText('“Omarchy”'), '"Omarchy"');
  assert.equal(normaliseText('don’t'), "don't");
  assert.equal(normaliseText('a — b'), 'a - b');
  assert.equal(normaliseText('and so on…'), 'and so on...');
  assert.equal(normaliseText('a b'), 'a b');
});

test('folds accents rather than dropping the glyph', () => {
  assert.equal(normaliseText('Tobi L&uuml;tke'), 'Tobi Lutke');
  assert.equal(normaliseText('Bjarne Øverli'), 'Bjarne Overli');
  assert.equal(normaliseText('Mehmet İnce'), 'Mehmet Ince');
  assert.equal(normaliseText('Krzysztof Wilczyński'), 'Krzysztof Wilczynski');
});

test('keeps mixed case: the site uppercases at load, not here', () => {
  assert.equal(normaliseText('Welcome to Omarchy!'), 'Welcome to Omarchy!');
});

test('is idempotent', () => {
  const once = normaliseText('  “Omarchy” — don’t  ');
  assert.equal(normaliseText(once), once);
});

test('caps paragraphs only when asked, on a word boundary', () => {
  const text = 'one two three four five six seven eight';
  assert.equal(capLength(text, 0), text, 'no cap by default');
  assert.equal(capLength(text, 500), text);
  const capped = capLength(text, 20);
  assert.ok(capped.length <= 20);
  assert.ok(capped.endsWith('...'));
  assert.ok(text.startsWith(capped.slice(0, -3)));
});

test('resolves relative URLs against the page', () => {
  assert.equal(normaliseUrl('/teams/', 'https://omarchy.org/air/'), 'https://omarchy.org/teams/');
  assert.equal(normaliseUrl('https://x.test/a?b=1&amp;c=2'), 'https://x.test/a?b=1&c=2');
  assert.equal(normaliseUrl('mailto:a@b.test'), 'mailto:a@b.test');
  assert.equal(normaliseUrl(''), '');
});

test('normalises whole node tuples and drops empty ones', () => {
  const nodes = normaliseNodes(
    [
      ['H2', '  Welcome  '],
      ['KV', ' Date ', ' 1 Sept '],
      ['A', 'Teams', '/teams/'],
      ['P', '   '],
      ['A', 'Nowhere', ''],
      'not a node',
    ],
    { base: 'https://omarchy.org/air/' },
  );
  assert.deepEqual(nodes, [
    ['H2', 'Welcome'],
    ['KV', 'Date', '1 Sept'],
    ['A', 'Teams', 'https://omarchy.org/teams/'],
  ]);
});
