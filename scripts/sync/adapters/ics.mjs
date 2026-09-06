/* Adapter: an iCalendar feed. Kept as the meetups fallback for the day the
 * Luma JSON endpoint changes shape — `https://api.lu.ma/ics/get?entity=
 * calendar&id=<cal-id>` serves the same calendar.
 *
 * Two traps this adapter works around, both verified against the live feed:
 * `STATUS` is `TENTATIVE` on every single event, so it is dropped rather than
 * reported as a status; and `DTSTAMP`/`SEQUENCE` change on every request, so
 * they are never read into the output — otherwise no two syncs would agree. */
import { normaliseNodes } from '../normalise.mjs';

/** Undo RFC 5545 line folding, then split into property lines. */
export function unfold(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

const unescape_ = (value) =>
  String(value)
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1');

/** Parse VEVENT blocks into plain objects keyed by property name. */
export function parseEvents(ics) {
  const events = [];
  let current = null;
  for (const line of unfold(ics)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const match = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
      if (!match) continue;
      const params = Object.fromEntries(
        [...match[2].matchAll(/;([A-Z-]+)=("?)([^";]*)\2/g)].map((m) => [m[1], m[3]]),
      );
      current[match[1]] = { value: unescape_(match[3]), params };
    }
  }
  return events;
}

/** `20260901T173000Z` → a Date. */
export function parseIcsDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value).trim());
  if (!m) return new Date(NaN);
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

const fmt = (date, options) =>
  Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(date);

/** The public event URL Luma hides in the DESCRIPTION text. */
function urlOf(event) {
  const description = event.DESCRIPTION?.value ?? '';
  const match = /(https:\/\/luma\.com\/[A-Za-z0-9-]+)/.exec(description);
  if (match) return match[1];
  const location = event.LOCATION?.value ?? '';
  return /^https?:\/\//.test(location) ? location : '';
}

/** Turn an ICS document into meetup nodes. Pure — no network. */
export function nodesFromIcs(ics, source = {}) {
  const nodes = source.lead ? [['H2', source.lead]] : [];
  const events = parseEvents(ics)
    .map((e) => ({ e, start: parseIcsDate(e.DTSTART?.value) }))
    .filter(({ e, start }) => e.SUMMARY?.value && !Number.isNaN(start.getTime()))
    .sort((a, b) => a.start - b.start)
    .slice(0, source.limit ?? Infinity);

  for (const { e, start } of events) {
    nodes.push(['H3', e.SUMMARY.value]);
    nodes.push([
      'KV',
      'Date',
      `${fmt(start, { day: 'numeric' })} ${fmt(start, { month: 'short' })} ${fmt(start, { weekday: 'long' })}`,
    ]);
    const end = e.DTEND ? parseIcsDate(e.DTEND.value) : undefined;
    const clock = { hour: '2-digit', minute: '2-digit', hour12: false };
    const time = end ? `${fmt(start, clock)} - ${fmt(end, clock)} UTC` : `${fmt(start, clock)} UTC`;
    nodes.push(['KV', 'Time', time]);
    const host = e.ORGANIZER?.params?.CN;
    if (host) nodes.push(['KV', 'Host', host]);
    const location = e.LOCATION?.value ?? '';
    if (location && !/^https?:\/\//.test(location)) nodes.push(['KV', 'Location', location]);
    const url = urlOf(e);
    if (url) nodes.push(['A', e.SUMMARY.value, url]);
  }
  return nodes;
}

export async function fetchNodes(source, deps) {
  const ics = await deps.fetchText(source.url);
  return {
    title: source.title,
    url: source.page ?? source.url,
    nodes: normaliseNodes(nodesFromIcs(ics, source), { maxParagraph: source.maxParagraph }),
  };
}
