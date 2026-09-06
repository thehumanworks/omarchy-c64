/**
 * Loads `content/*.json` and normalises it for a machine that only has
 * upper-case ASCII: every editorial string is upper-cased and every curly
 * quote becomes its straight ASCII twin. URLs are left exactly as authored.
 *
 * Owns: the in-memory shape of the content layer (`menu`, `shortcuts`,
 * `strings`, `pages`). Must not import anything from `src/` — it is the
 * bottom of the stack — and must not touch the DOM.
 */

import menuJson from '../../content/menu.json' with { type: 'json' };
import shortcutsJson from '../../content/shortcuts.json' with { type: 'json' };
import stringsJson from '../../content/strings.json' with { type: 'json' };
import air from '../../content/pages/air.json' with { type: 'json' };
import manual from '../../content/pages/manual.json' with { type: 'json' };
import meetups from '../../content/pages/meetups.json' with { type: 'json' };
import news from '../../content/pages/news.json' with { type: 'json' };
import patrons from '../../content/pages/patrons.json' with { type: 'json' };
import security from '../../content/pages/security.json' with { type: 'json' };
import sponsors from '../../content/pages/sponsors.json' with { type: 'json' };
import teams from '../../content/pages/teams.json' with { type: 'json' };
import workstations from '../../content/pages/workstations.json' with { type: 'json' };

const PAGE_FILES = [manual, air, security, news, teams, patrons, sponsors, meetups, workstations];

/** Upper-case, and fold the typographic quotes a scraper leaves behind. */
function normalise(text) {
  return String(text).toUpperCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

const deep = (v) =>
  typeof v === 'string'
    ? normalise(v)
    : Array.isArray(v)
      ? v.map(deep)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))
        : v;

/** A node is `[KIND, ...text]`; the kind stays put and `A` keeps its raw URL. */
function normaliseNode(node) {
  return node.map((part, i) => (i === 0 || (node[0] === 'A' && i === 2) ? part : normalise(part)));
}

function normalisePage(p) {
  return {
    key: p.key,
    title: normalise(p.title),
    url: p.url,
    nodes: p.nodes.map(normaliseNode),
  };
}

/** The 14 main-menu entries, in order. */
export const menu = menuJson.map((e) => ({
  label: normalise(e.label),
  url: e.url,
  blocks: e.blocks,
}));

/** Typed names that are not on the menu but still go somewhere. */
export const shortcuts = shortcutsJson;

/** Ticker, hints, page copy and every other editorial string. */
export const strings = deep(stringsJson);

/** First-party pages, keyed by the menu label that opens them. */
export const pages = Object.fromEntries(PAGE_FILES.map((p) => [p.key, normalisePage(p)]));
