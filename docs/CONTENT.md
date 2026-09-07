# Content

Everything shown as tube copy lives in `content/`. Existing page wording is
edited here without changing `src/`. Site metadata, accessible fallback copy
and control labels live in `site/index.html`. Keep its fallback/screen-reader
links aligned when changing menu URLs.

```
content/
  menu.json          the 14 main-menu entries, in menu order
  shortcuts.json     typed names that are not on the menu → URLs
  strings.json       ticker, hints, taglines, HELP/ABOUT/LIST/DIR copy, chrome
  pages/<key>.json   one file per first-party page shown on the tube
```

`src/content/index.js` imports these files (`with { type: 'json' }`, which both
Node and esbuild understand) and normalises them. It is the only module that
reads `content/`; everything else takes `content` as a parameter.

## Normalisation

The machine has one character set: upper-case ASCII. On load, `index.js`

- upper-cases every editorial string, and
- folds the typographic quotes a scraper leaves behind: `“ ” → "`, `‘ ’ → '`.

It never touches a URL, and never touches a node's kind. So page files may be
written in ordinary mixed case with real apostrophes — which is what the
scraped originals look like — and still render correctly.

Anything the character ROM has no glyph for (accents, em dashes, braces) is
drawn as a space. Stick to ASCII plus `·` (U+00B7) and `£`.

## `content/pages/<key>.json`

```json
{
  "key": "NEWS",
  "title": "Omarchy News",
  "url": "https://omarchy.org/news/",
  "nodes": [
    ["H2", "The first plugin competition winners"],
    ["P", "Two sentences of body copy. Each one becomes its own block."],
    ["LI", "A bullet"],
    ["KV", "Date", "August 28, 2026"],
    ["A", "Read more", "https://omarchy.org/news/2026/08/..."]
  ]
}
```

- `key` — the menu label this page belongs to. It must match one, exactly.
- `title` — printed in the box header at the top of the tube.
- `url` — the same URL the menu entry carries, so a link that points here opens
  on the tube instead of in a tab.
- `nodes` — compact tuples, rendered in order by `src/machine/doc-lines.js`.

### Node kinds

| Kind | Shape                | Renders as                                                                 |
| ---- | -------------------- | -------------------------------------------------------------------------- |
| `H2` | `["H2", text]`       | yellow heading with a cyan rule under it, blank line before                |
| `H3` | `["H3", text]`       | yellow heading, blank line before, no rule                                 |
| `P`  | `["P", text]`        | white body, one sentence per block, continuation lines hang two columns in |
| `LI` | `["LI", text]`       | cyan bullet, `- ` then a hanging indent                                    |
| `KV` | `["KV", key, value]` | light grey `KEY: VALUE`                                                    |
| `A`  | `["A", label, url]`  | green label then the cyan destination, both clickable                      |

Two rules the renderer applies for you: an `A` whose label repeats the `H3`
right above it prints only its destination, and an `A` whose destination reads
the same as its label prints only once. Blank rows are never stacked, and a
page never opens or ends on one.

## Adding or editing a page

1. Write `content/pages/<lowercase key>.json` in the shape above.
2. Add it to the import list and to `PAGE_FILES` in `src/content/index.js`
   (there is no globbing: the bundle needs static imports).
3. Make sure a `content/menu.json` entry has the same label and URL.
4. `npm run test:unit` — `test/unit/machine/content.test.js` checks the key
   matches a menu label, the URLs agree, the normalisation held, and that every
   node kind/tuple shape is supported. It also catches unregistered page files.

To change wording only, edit the JSON and rebuild. Nothing else moves.

## Where the content comes from

The committed page files are the maintained snapshot for this archived edition.
Edit them directly for editorial changes; no comparison with today's main
website is required. The build and runtime never read `content/sources.json`
or call a content service.

The previous importer remains as an **optional manual tool**. Its configuration
in `content/sources.json` describes historical sources, for example:

```json
"NEWS": {
  "adapter": "feed",
  "url": "https://omarchy.org/news/rss.xml",
  "page": "https://omarchy.org/news/",
  "limit": 12,
  "minNodes": 10
}
```

`adapter` names a file in `scripts/sync/adapters/`; every other field is that
adapter's configuration. `url` is where the bytes come from and `page` is what
the tube links to, which is why the NEWS entry can read an RSS feed while still
matching the menu's `/news/` URL. The adapters today:

| Adapter           | For                                                  | Used by                                 |
| ----------------- | ---------------------------------------------------- | --------------------------------------- |
| `github-markdown` | markdown chapters in a GitHub repo                   | MANUAL                                  |
| `feed`            | RSS 2.0 or Atom                                      | NEWS                                    |
| `luma`            | the Luma calendar JSON API                           | MEETUPS                                 |
| `ics`             | an iCalendar feed (the meetups fallback)             | —                                       |
| `html`            | a rendered page, via CSS selectors                   | AIR, SECURITY, TEAMS, PATRONS, SPONSORS |
| `static`          | "no source worth syncing" — keeps the committed file | WORKSTATIONS                            |

**[Content sources](CONTENT-SOURCES.md) records historical provenance**: which repo, which URL, which
licence, and how stable each source looked when it was checked. Read it before
changing a source, and update it when you do.

### Optional manual import

A manual import can overwrite local editorial changes. Inspect a dry run first,
review the JSON diff after importing, and run `npm run check`. Do not import
merely because a snapshot differs from the current main website.

```sh
npm run sync -- --dry-run       # preview differences and source failures
npm run sync -- --only NEWS     # import one page (comma-separated, repeatable)
npm run sync                    # import every configured page
npm run sync -- --menu          # also refresh menu URLs from sources.json
```

With unchanged source data/configuration, repeated imports produce no diff.
On failure, an unreachable source leaves that page's committed JSON
alone, and the run reports it and exits non-zero. It never touches
`content/menu.json` unless you pass `--menu`, and even then only the URLs; the
labels, order and block counts are editorial. It writes the same
`{key,title,url,nodes}` shape documented above, formatted through prettier, so
`npm run format:check` and the sync always agree.

There is no scheduled sync workflow, freshness CI job, commit hook or required
network check. `--dry-run` remains useful for an explicitly requested import:
exit 0 means no differences, 1 means differences or source failure (read the
summary), and 2 means a usage/configuration error. `--only KEY` accepts a
comma-separated list and may be repeated. `GITHUB_TOKEN` is optional for the
manual's GitHub API rate limit; handle it through the existing secret provider.

To keep a locally edited page out of future bulk imports, replace its source
record with `{"adapter": "static", "url": "THE_COMMITTED_PAGE_URL", "reason": "Maintained locally"}`.
Remove old adapter-specific fields, especially a `page` URL override; `--menu`
uses the source URL, so it must agree with the committed page/menu. New snapshot pages need no source entry
unless they should participate in the manual importer. The importer and its
fixture tests are independent of the runtime; future owners can replace or
retire them without changing the `{key,title,url,nodes}` rendering contract.

### Changing where a page comes from

The source is _expected_ to move. The node tuples are the stable contract;
everything upstream of them is configuration.

**A new fetch URL, same shape.** Change `url` in `sources.json` and preview the
import. If the canonical page URL also changed, align the source's `page`
override, the snapshot URL, menu URL and fallback/screen-reader links.

**The markup changed.** Change that page's selectors — `root`, `exclude`,
`pairs`, `promote`. Still no code.

**A different kind of source.** Read the candidate adapter and its fixtures
before choosing it. `github-markdown` builds a manual chapter index from
`repo`, `dir` and `lede`; it is not a generic news article importer. Verify the
emitted tuples rather than assuming a format name guarantees compatible output.

**Somewhere no adapter handles.** Add one file:

```js
// scripts/sync/adapters/my-source.mjs
export async function fetchNodes(source, deps) {
  const raw = await deps.fetchText(source.url);
  return { title: source.title, url: source.url, nodes: [/* node tuples */] };
}
```

Adapters take their I/O as `deps` (`fetchText`, `fetchJson`, `readCurrent`) and
never call `fetch` themselves — that is what lets the tests drive them from
fixtures with no network. Export the pure "bytes in, nodes out" half, run it
through `normaliseNodes` from `scripts/sync/normalise.mjs`, and add a suite
under `test/unit/sync/` with a small fixture in `test/fixtures/sync/`. Then
point the page at it in `sources.json` and record why in
`docs/CONTENT-SOURCES.md`.

**Nothing can source it reliably.** Set `"adapter": "static"` with a `reason`.
The sync leaves the snapshot alone and reports the page as skipped rather than
pretending it succeeded. WORKSTATIONS is the worked example: eighty photographs
with no captions.

### Guard rails

The sync refuses to write a page that looks like a broken scrape: zero nodes,
fewer than that page's `minNodes`, or less than half what the committed file
had. A silently broken selector becomes a loud failure and the good snapshot
survives.

## `content/menu.json`

```json
{ "label": "MANUAL", "url": "https://omarchy.org/manual/", "blocks": 41 }
```

- `label` — what the menu shows, what `DIR` lists, and what you can type at the
  READY prompt (exactly, or as a prefix of three characters or more).
- `url` — where the entry goes.
- `blocks` — the fake 1541 block count `DIR` prints. Cosmetic.

**How the menu maps to pages:** a menu label with a matching
`content/pages/<lowercase label>.json` opens **on the tube** as a document; anything else
opens a **new browser tab**. Nine of the fourteen entries are first-party pages
today; ISO, PLUGINS, GITHUB, DISCORD and MERCH are tabs. To move an entry onto
the tube, add a page file and register its static import as described above.

The menu is also the source of truth for the numbers `1`–`14` at the prompt and
for the cursor-key order.

## `content/shortcuts.json`

A flat `NAME → URL` map for things worth typing but not worth a menu row
(`DHH`, `HEY`, `BASECAMP`, `MAIL`, …). Names must be upper case. Typed shortcuts
use `openLink` (the existing anchor/tab path). Following a document's `mailto:`
link uses the current location. These distinct behaviors are covered by
`test/unit/machine/navigate.test.js`; changing them is a separate behavior task.

## `content/strings.json`

Grouped by where the text appears:

| Key             | Used by                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `ticker`        | the scrolling line at the foot of every page (`machine/chrome.js`)      |
| `hints`         | the rotating hint above READY; a hint wider than the tube is skipped    |
| `chrome`        | the title bar and the `READY.` prompt                                   |
| `menu`          | tagline, byline, blurb, box caption and footer (`machine/menu.js`)      |
| `doc`           | the two footers of a document page                                      |
| `help`          | the `HELP` table — `["COMMAND", "DESCRIPTION"]`, `null` for a blank row |
| `about`, `list` | the `ABOUT` and `LIST` pages                                            |
| `dir`           | the `DIR` header and footer                                             |
| `boot`          | every line the power-on sequence types                                  |
| `maze`          | the footer under `10 PRINT`                                             |
| `status`        | the flash messages; `$1` is substituted at run time                     |
| `labels`        | hover metadata (no visible badge); `open` uses `$1` for the menu label  |

Lines in `about.lines` and `list.lines` are either `""` (a blank row) or
`[text, "COLOURNAME"]`. Colour names are resolved by `src/text/palette.js` —
see `NAMES` there for the sixteen that exist. Some strings have a wide and a
narrow variant (`blurbWide` / `blurb`, `footerWide` / `footer`,
`versionWide` / `version`); the renderer picks by column count.
