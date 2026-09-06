import test from 'node:test';
import assert from 'node:assert/strict';
import { nodesFromHtml, fetchNodes } from '../../../scripts/sync/adapters/html.mjs';
import { fixture, stubDeps, kinds } from './helpers.js';

const TEAMS = {
  url: 'https://omarchy.org/teams/',
  title: 'THE TEAMS',
  root: 'main.main',
  exclude: 'img',
  pairs: [{ match: 'article.member', key: '.member__name', value: '.member__meta' }],
};

test('teams: members become KV name -> country', () => {
  const { nodes } = nodesFromHtml(fixture('teams.html'), TEAMS);
  assert.deepEqual(kinds(nodes, 'KV'), [
    ['DHH', 'USA/Denmark'],
    ['Tobi Lutke', 'Canada'],
  ]);
});

test('teams: a member with no meta degrades to LI rather than half a pair', () => {
  const { nodes } = nodesFromHtml(fixture('teams.html'), TEAMS);
  assert.ok(
    nodes.some((n) => n[0] === 'LI' && n[1] === 'Mihai'),
    'Mihai has no member__meta and must not vanish',
  );
});

test('teams: the h1 opens the page as an H2 when it is not the title', () => {
  const { nodes, title } = nodesFromHtml(fixture('teams.html'), TEAMS);
  assert.equal(title, 'THE TEAMS');
  assert.deepEqual(nodes[0], ['H2', 'The teams guiding Omarchy']);
});

test('the h1 is not repeated when it already is the title', () => {
  const { nodes } = nodesFromHtml(fixture('teams.html'), {
    ...TEAMS,
    title: 'THE TEAMS GUIDING OMARCHY',
  });
  assert.notDeepEqual(nodes[0], ['H2', 'The teams guiding Omarchy']);
});

test('teams: section headings and descriptions survive, images do not', () => {
  const { nodes } = nodesFromHtml(fixture('teams.html'), TEAMS);
  assert.ok(nodes.some((n) => n[0] === 'H2' && n[1] === 'Omarchy Core'));
  assert.ok(nodes.some((n) => n[0] === 'P' && n[1] === 'Setting the direction'));
  assert.ok(!JSON.stringify(nodes).includes('.webp'));
});

test('air: a resident reads H3 name, P bio, then the profile link', () => {
  const { nodes, title } = nodesFromHtml(fixture('air.html'), {
    url: 'https://omarchy.org/air/',
    title: 'OMARCHY AIR',
    root: 'main.main',
    exclude: 'img',
    deferHeadingLinks: true,
  });
  assert.equal(title, 'OMARCHY AIR');
  assert.deepEqual(nodes[0], ['H2', 'Artists in Residence']);
  const at = nodes.findIndex((n) => n[0] === 'H3');
  assert.deepEqual(nodes[at], ['H3', 'HANCORE']);
  assert.equal(nodes[at + 1][0], 'P', 'the bio comes before the link');
  assert.deepEqual(nodes[at + 2], ['A', 'HANCORE', 'https://github.com/HANCORE-linux']);
});

test('air: list items keep their text and the em dash is folded', () => {
  const { nodes } = nodesFromHtml(fixture('air.html'), { root: 'main.main', exclude: 'img' });
  assert.deepEqual(kinds(nodes, 'LI'), [
    ['$2,500/month for the full six months.'],
    ['Token account so the agents never need to stop.'],
  ]);
  assert.ok(nodes.some((n) => n[1].includes('Omarchy - more than')));
});

test('sponsorships: the tier becomes KV Tier via a literal keyText rule', () => {
  const { nodes } = nodesFromHtml(fixture('sponsorships.html'), {
    url: 'https://omarchy.org/sponsorships/',
    title: 'OMACOM FOUNDATION FUNDING',
    root: 'main.main',
    exclude: 'img, .sponsorship__logo',
    pairs: [{ match: 'p.sponsorship__terms', keyText: 'Tier', value: ':self' }],
  });
  assert.deepEqual(kinds(nodes, 'KV'), [['Tier', 'Exclusive']]);
  assert.deepEqual(nodes[0], ['H2', 'Hyprland'], 'the h1 is the title, so it does not repeat');
});

test('relative hrefs resolve against the page URL', () => {
  const { nodes } = nodesFromHtml(fixture('teams.html'), TEAMS);
  assert.ok(nodes.some((n) => n[0] === 'A' && n[2] === 'https://omarchy.org/teams/#rangers'));
});

test('a missing root selector fails loudly instead of writing an empty page', () => {
  assert.throws(
    () => nodesFromHtml(fixture('teams.html'), { root: '.does-not-exist' }),
    /no element matched/,
  );
});

test('fetchNodes takes its I/O from deps, so the suite never hits the network', async () => {
  const deps = stubDeps({ 'omarchy.org/teams/': fixture('teams.html') });
  const result = await fetchNodes(TEAMS, deps);
  assert.equal(result.url, 'https://omarchy.org/teams/');
  assert.deepEqual(deps.calls, ['https://omarchy.org/teams/']);
  assert.ok(result.nodes.length > 5);
});
