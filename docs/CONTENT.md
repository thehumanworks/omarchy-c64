# Content

Everything the site _says_ lives in `content/`. Code never hard-codes copy, so
changing the wording, the menu or a page must not require touching `src/`.

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
   node kind is one the renderer knows.

To change wording only, edit the JSON and rebuild. Nothing else moves.

## Where the content comes from

The page files are not hand-maintained snapshots. `content/sources.json` says
where each one is pulled from, and `npm run sync` pulls it:

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

**`docs/CONTENT-SOURCES.md` is the evidence**: which repo, which URL, which
licence, and how stable each source looked when it was checked. Read it before
changing a source, and update it when you do.

### Running a sync

```
npm run sync                    fetch everything, rewrite what changed
npm run sync:check              dry run; exits 1 if anything would change
npm run sync -- --only NEWS     one page (comma-separated, repeatable)
npm run sync -- --menu          also refresh menu.json's URLs from sources.json
```

The sync is idempotent — running it twice leaves the second run nothing to do —
and safe under failure: an unreachable source leaves that page's committed JSON
alone, and the run reports it and exits non-zero. It never touches
`content/menu.json` unless you pass `--menu`, and even then only the URLs; the
labels, order and block counts are editorial. It writes the same
`{key,title,url,nodes}` shape documented above, formatted through prettier, so
`npm run format:check` and the sync always agree.

A weekly GitHub Actions run (`.github/workflows/sync-content.yml`, Mondays at
06:00 UTC) does the same and opens a pull request on the `content-sync` branch
with the diff summary in the body. It never pushes to `main`: the diff is copy,
and a human should read it.

### Changing where a page comes from

The source is _expected_ to move. The node tuples are the stable contract;
everything upstream of them is configuration.

**A new URL, same shape.** Change `url` in `sources.json`. Nothing else.

**The markup changed.** Change that page's selectors — `root`, `exclude`,
`pairs`, `promote`. Still no code.

**A different kind of source** — say the news markdown lands in a licensed
repo. Change `adapter` to `github-markdown` and give it `repo`/`dir`. The
adapter already exists.

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
`content/pages/<label>.json` opens **on the tube** as a document; anything else
opens a **new browser tab**. Nine of the fourteen entries are first-party pages
today; ISO, PLUGINS, GITHUB, DISCORD and MERCH are tabs. To move an entry onto
the tube, add a page file with its label as the key — no code change.

The menu is also the source of truth for the numbers `1`–`14` at the prompt and
for the cursor-key order.

## `content/shortcuts.json`

A flat `NAME → URL` map for things worth typing but not worth a menu row
(`DHH`, `HEY`, `BASECAMP`, `MAIL`, …). Names must be upper case. A `mailto:`
URL is handled specially by `src/machine/navigate.js`: it navigates rather than
opening a tab.

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
| `labels`        | the hardware hint pill; `open` uses `$1` for the menu label             |

Lines in `about.lines` and `list.lines` are either `""` (a blank row) or
`[text, "COLOURNAME"]`. Colour names are resolved by `src/text/palette.js` —
see `NAMES` there for the sixteen that exist. Some strings have a wide and a
narrow variant (`blurbWide` / `blurb`, `footerWide` / `footer`,
`versionWide` / `version`); the renderer picks by column count.
