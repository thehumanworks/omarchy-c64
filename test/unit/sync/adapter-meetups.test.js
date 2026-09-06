import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarIdFrom,
  nodesFromEvents,
  formatDate,
  formatTime,
  fetchNodes,
} from '../../../scripts/sync/adapters/luma.mjs';
import { nodesFromIcs, parseEvents, unfold } from '../../../scripts/sync/adapters/ics.mjs';
import { fixture, fixtureJson, stubDeps } from './helpers.js';

const MEETUPS = {
  url: 'https://omarchy.org/meetups/',
  title: 'MEETUPS',
  lead: 'Meetups around the world',
  openLabel: 'Open in Luma',
  calendarSelector: '.meetups__embed',
  rulesRoot: 'section.rules',
  promote: [{ match: 'p.rule__name', kind: 'H3' }],
};

test('the Luma calendar id is read from the iframe, never hardcoded', () => {
  assert.equal(calendarIdFrom(fixture('meetups.html')), 'cal-SDGGMsEps9ExsrT');
  assert.equal(calendarIdFrom('<body><main></main></body>'), undefined);
});

test('an event becomes H3 title, KV Date/Time/Host/Location, then its link', () => {
  const nodes = nodesFromEvents(fixtureJson('luma-events.json'));
  assert.deepEqual(nodes.slice(0, 6), [
    ['H3', 'Omarchy BLR Meetup 001'],
    ['KV', 'Date', '6 Sept Sunday'],
    ['KV', 'Time', '17:30 - 19:00 GMT+5:30'],
    ['KV', 'Host', 'Megabyte, Devfolio'],
    ['KV', 'Location', 'Bengaluru, India'],
    ['A', 'Omarchy BLR Meetup 001', 'https://luma.com/blr-001'],
  ]);
});

test('times are rendered in the event timezone, not in ours', () => {
  assert.equal(
    formatTime('2026-09-06T12:00:00Z', '2026-09-06T13:30:00Z', 'Asia/Kolkata'),
    '17:30 - 19:00 GMT+5:30',
  );
  assert.equal(formatDate('2026-09-06T12:00:00Z', 'Asia/Kolkata'), '6 Sept Sunday');
  assert.equal(formatTime('2026-09-10T11:00:00Z', undefined, 'Asia/Tokyo'), '20:00 GMT+9');
  assert.equal(formatDate('nonsense', 'UTC'), '');
});

test('missing host and location are omitted rather than emitted empty', () => {
  const nodes = nodesFromEvents(fixtureJson('luma-events.json'));
  const tokyo = nodes.slice(nodes.findIndex((n) => n[1] === 'Omarchy TOKYO Night'));
  assert.ok(!tokyo.some((n) => n[0] === 'KV' && n[1] === 'Host'));
  assert.ok(!tokyo.some((n) => n[0] === 'KV' && n[1] === 'Location'));
});

test('an active waitlist becomes KV Status', () => {
  const nodes = nodesFromEvents(fixtureJson('luma-events.json'));
  assert.ok(nodes.some((n) => n[0] === 'KV' && n[1] === 'Status' && n[2] === 'Waitlist'));
});

test('the page contributes only its rules; the events come from the API', async () => {
  const deps = stubDeps({
    'omarchy.org/meetups/': fixture('meetups.html'),
    'api.lu.ma/calendar/get-items': fixtureJson('luma-events.json'),
  });
  const { title, nodes } = await fetchNodes(MEETUPS, deps);

  assert.equal(title, 'MEETUPS');
  assert.deepEqual(nodes[0], ['H2', 'Meetups around the world']);
  assert.deepEqual(nodes[1], ['A', 'Open in Luma', 'https://luma.com/omarchy']);
  assert.ok(nodes.some((n) => n[0] === 'H2' && n[1] === 'The rules'));
  assert.deepEqual(
    nodes.slice(-2),
    [
      ['H3', 'About Omarchy'],
      ['P', 'Keep it on topic.'],
    ],
    'a rule is a heading plus its body, not one run-together list item',
  );
  assert.ok(
    deps.calls.some((u) => u.includes('calendar_api_id=cal-SDGGMsEps9ExsrT')),
    'the id from the iframe is what gets queried',
  );
});

test('a page with no calendar id fails loudly', async () => {
  const deps = stubDeps({ 'omarchy.org/meetups/': '<body><main></main></body>' });
  await assert.rejects(() => fetchNodes(MEETUPS, deps), /no Luma calendar id/);
});

test('ICS fallback: folded lines are rejoined, fold space and all', () => {
  // RFC 5545 folds by inserting CRLF plus one space; the space is the marker
  // and is removed with the break. Luma folds mid-word, so keeping it would
  // turn "Address" into "Ad dress".
  assert.deepEqual(unfold('A:Ad\r\n dress\r\nB:three'), ['A:Address', 'B:three']);
});

test('ICS fallback: VEVENTs parse with their parameters', () => {
  const events = parseEvents(fixture('luma.ics'));
  assert.equal(events.length, 2);
  assert.equal(events[0].SUMMARY.value, 'Omarchy Meetup: Egypt');
  assert.equal(events[0].ORGANIZER.params.CN, 'Ziad');
});

test('ICS fallback produces the same node shape, sorted by start', () => {
  const nodes = nodesFromIcs(fixture('luma.ics'));
  assert.deepEqual(nodes[0], ['H3', 'Omarchy Meetup Sao Paulo'], 'earlier event first');
  const egypt = nodes.slice(nodes.findIndex((n) => n[1] === 'Omarchy Meetup: Egypt'));
  assert.deepEqual(egypt[1], ['KV', 'Date', '26 Aug Wednesday']);
  assert.deepEqual(egypt[2], ['KV', 'Time', '14:00 - 16:00 UTC']);
  assert.deepEqual(egypt[3], ['KV', 'Host', 'Ziad']);
  assert.deepEqual(egypt[4], ['KV', 'Location', 'Al Shorouk City, El Shorouk, Egypt']);
  assert.deepEqual(egypt[5], ['A', 'Omarchy Meetup: Egypt', 'https://luma.com/ylmes5ls']);
});

test('ICS fallback ignores STATUS, which is TENTATIVE on every Luma event', () => {
  const nodes = nodesFromIcs(fixture('luma.ics'));
  assert.ok(!nodes.some((n) => n[0] === 'KV' && n[1] === 'Status'));
});

test('ICS fallback drops a URL masquerading as a location', () => {
  const nodes = nodesFromIcs(fixture('luma.ics'));
  const sao = nodes.slice(
    0,
    nodes.findIndex((n) => n[1] === 'Omarchy Meetup: Egypt'),
  );
  assert.ok(!sao.some((n) => n[0] === 'KV' && n[1] === 'Location'));
  assert.ok(sao.some((n) => n[0] === 'A' && n[2] === 'https://luma.com/dhcang6s'));
});
