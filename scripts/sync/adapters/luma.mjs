/* Adapter: the Omarchy meetups calendar on Luma.
 *
 * omarchy.org/meetups/ holds no event data at all — just an iframe and the
 * community rules. So this adapter does two things: it reads the calendar id
 * out of the iframe's `src` (never hardcode it) and calls Luma's public JSON
 * API for the events, then walks the page's own rules section for the prose
 * underneath. See docs/CONTENT-SOURCES.md for why the JSON beats the ICS.
 *
 * Source options: `url` (the meetups page), `calendarSelector`, `calendarId`
 * (an explicit override), `period`, `limit`, `rulesRoot`, `lead`, `openLabel`.
 */
import { parseHtml, query, attr } from '../dom.mjs';
import { nodesFromElement } from '../nodes.mjs';
import { normaliseNodes } from '../normalise.mjs';

const API = 'https://api.lu.ma/calendar/get-items';

/** Dig `cal-XXXX` out of `https://luma.com/embed/calendar/cal-XXXX/events`. */
export function calendarIdFrom(html, selector = '.meetups__embed') {
  const embed = query(parseHtml(html), selector);
  const src = embed && attr(embed, 'src');
  const id = src && /\/calendar\/(cal-[A-Za-z0-9]+)/.exec(src);
  return id ? id[1] : undefined;
}

/** "1 Sept Tuesday", the shape the tube already prints. */
export function formatDate(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const part = (options) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || 'UTC', ...options }).format(date);
  return `${part({ day: 'numeric' })} ${part({ month: 'short' })} ${part({ weekday: 'long' })}`;
}

/** "17:30 - 18:30 EDT". A missing end time yields just the start. */
export function formatTime(startIso, endIso, timeZone) {
  const zone = timeZone || 'UTC';
  const clock = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(new Date(startIso))
    .find((p) => p.type === 'timeZoneName')?.value;
  const start = clock(startIso);
  if (!start) return '';
  const end = endIso ? clock(endIso) : '';
  return [end ? `${start} - ${end}` : start, label].filter(Boolean).join(' ');
}

/** "Atlanta, United States", falling back to whatever geo data exists. */
function locationOf(event) {
  const geo = event.geo_address_info ?? {};
  const city = geo.city ?? geo.city_state ?? geo.sublocality ?? geo.region;
  return [city, geo.country].filter(Boolean).join(', ');
}

/** Luma's own capacity signals. The ICS `STATUS` field is useless: it is
 * `TENTATIVE` on every event, so we read the JSON's fields instead. */
function statusOf(entry) {
  if (entry.waitlist_active) return 'Waitlist';
  const availability = entry.registration_availability;
  if (availability === 'sold_out') return 'Sold Out';
  if (availability === 'near_capacity') return 'Near Capacity';
  return '';
}

/** Turn one API payload into event nodes. Pure: the tests drive it directly. */
export function nodesFromEvents(payload, source = {}) {
  const nodes = [];
  for (const entry of (payload.entries ?? []).slice(0, source.limit ?? Infinity)) {
    const event = entry.event ?? {};
    if (!event.name) continue;
    nodes.push(['H3', event.name]);
    const zone = event.timezone;
    const date = formatDate(event.start_at, zone);
    if (date) nodes.push(['KV', 'Date', date]);
    const time = formatTime(event.start_at, event.end_at, zone);
    if (time) nodes.push(['KV', 'Time', time]);
    const hosts = (entry.hosts ?? []).map((h) => h.name).filter(Boolean);
    if (hosts.length) nodes.push(['KV', 'Host', hosts.join(', ')]);
    const location = locationOf(event);
    if (location) nodes.push(['KV', 'Location', location]);
    const status = statusOf(entry);
    if (status) nodes.push(['KV', 'Status', status]);
    if (event.url) nodes.push(['A', event.name, `https://luma.com/${event.url}`]);
  }
  return nodes;
}

/** The rules that live in the meetups page itself, under the calendar. */
function rulesNodes(html, source) {
  if (!source.rulesRoot) return [];
  const root = query(parseHtml(html), source.rulesRoot);
  if (!root) return [];
  return nodesFromElement(root, {
    base: source.url,
    exclude: source.exclude,
    promote: source.promote ?? [],
  });
}

export async function fetchNodes(source, deps) {
  const page = await deps.fetchText(source.url);
  const calendarId = source.calendarId ?? calendarIdFrom(page, source.calendarSelector);
  if (!calendarId) throw new Error(`sync: no Luma calendar id in ${source.url}`);
  const query_ = new URLSearchParams({
    calendar_api_id: calendarId,
    period: source.period ?? 'future',
    pagination_limit: String(source.limit ?? 100),
  });
  const payload = await deps.fetchJson(`${API}?${query_}`);
  const nodes = [
    ...(source.lead ? [['H2', source.lead]] : []),
    [
      'A',
      source.openLabel ?? 'Open in Luma',
      `https://luma.com/${source.calendarSlug ?? 'omarchy'}`,
    ],
    ...nodesFromEvents(payload, source),
    ...rulesNodes(page, source),
  ];
  return {
    title: source.title,
    url: source.url,
    nodes: normaliseNodes(nodes, { base: source.url, maxParagraph: source.maxParagraph }),
  };
}
