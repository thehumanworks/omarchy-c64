# Where omarchy.org's content actually lives

Research current as of **2026-09-06**. This file is the evidence behind
`content/sources.json`. When a source moves, update the relevant row here and
the one line in `sources.json` that points at it.

## The landscape

There are three separate repositories in play, and only one of them is licensed.

| Repo                  | What it holds                                                            | Public | Licence                        | Default branch |
| --------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------ | -------------- |
| `omacom/omarchy`      | the OS **and the manual's authoritative markdown** (`manual/NN-slug.md`) | yes    | **MIT**                        | `quattro`      |
| `omacom/omarchy-site` | omarchy.org itself: pre-built HTML, plus `content/news/**.md`            | yes    | **none (all rights reserved)** | `master`       |
| `omacom/website`      | omacom.io, not omarchy.org                                               | yes    | none                           | —              |

`github.com/basecamp/omarchy` redirects to `omacom/omarchy`: Basecamp is not
the owner, `omacom` is. There is no separate repo under `dhh`.

The site is a static GitHub Pages deployment: the HTML in `omacom/omarchy-site`
is committed pre-built and is byte-identical to what omarchy.org serves. That
means every scraped page has a real `git log` behind it, which is the best
change-detection signal available to us.

### Robots, terms, licence

- `https://omarchy.org/robots.txt` → **404**. No crawl rules are published, so
  nothing is disallowed.
- No `/terms/`, `/legal/`, `/privacy/` or `/license/` page exists (all 404).
- Analytics is Plausible; there is no bot challenge, no consent wall, and a
  plain `curl` with the default user agent works on every URL.
- Practical posture: the manual is MIT and safe to reuse. Everything else is
  publicly readable with **no explicit licence grant**. We fetch politely
  (weekly), we keep every page's canonical `url` so the tube links back, and we
  quote rather than republish wholesale. Treat that as a deliberate, reviewable
  choice, not as a settled licence question — see the open questions below.

## Per page

| Page         | Canonical URL                       | Machine-readable source                | Format   | Adapter           | Confidence |
| ------------ | ----------------------------------- | -------------------------------------- | -------- | ----------------- | ---------- |
| MANUAL       | `https://omarchy.org/manual/`       | `omacom/omarchy` `manual/*.md`         | Markdown | `github-markdown` | **high**   |
| NEWS         | `https://omarchy.org/news/`         | `https://omarchy.org/news/rss.xml`     | RSS 2.0  | `feed`            | **high**   |
| MEETUPS      | `https://omarchy.org/meetups/`      | `https://api.lu.ma/calendar/get-items` | JSON     | `luma`            | **high**   |
| AIR          | `https://omarchy.org/air/`          | none — rendered HTML                   | HTML     | `html`            | medium     |
| SECURITY     | `https://omarchy.org/security/`     | none — rendered HTML                   | HTML     | `html`            | medium     |
| TEAMS        | `https://omarchy.org/teams/`        | none — rendered HTML                   | HTML     | `html`            | medium     |
| PATRONS      | `https://omarchy.org/patrons/`      | none — rendered HTML                   | HTML     | `html`            | medium     |
| SPONSORS     | `https://omarchy.org/sponsorships/` | none — rendered HTML                   | HTML     | `html`            | medium     |
| WORKSTATIONS | `https://omarchy.org/workstations/` | none — 80 images, no text              | —        | `static`          | n/a        |

### MANUAL — the one genuinely good source

The manual is generated, not hand-written HTML. `omacom/omarchy-site`'s
`bin/build-manual` says so in its own header: it regenerates `manual/` from
"the authoritative markdown chapters in the omarchy repo". Those chapters are:

```
https://raw.githubusercontent.com/omacom/omarchy/<branch>/manual/01-welcome-to-omarchy.md
… 51 files, NN-slug.md → /manual/slug/ (01 → /manual/)
```

MIT licensed, stable filenames, and the chapter order is the numeric prefix.
The current snapshot's shape (H2 "Welcome to Omarchy!" + the lede paragraphs +
H2 "Contents" + one LI per chapter) falls straight out of chapter 01 plus the
directory listing, which is exactly what the adapter does.

**Do not hardcode the branch.** It is `quattro` today and was something else
for v3; the adapter resolves the repo's default branch through the GitHub API
and falls back to the configured branch only if that call fails.

Two sources were considered and rejected:

- `https://omarchy.org/manual/search-index.json` (200, 191 KB, 297 entries of
  `{chapter, title, url, text}`) — real JSON, but markdown-stripped plain text
  and completely undocumented. Fine for search, lossy for us.
- `https://manuals.omamix.org/2/the-omarchy-manual` **301 → **
  `https://learn.omacom.io/2/the-omarchy-manual` (200). Both still resolve but
  this is a legacy Writebook titled "The Omarchy 3 Manual" — superseded and
  stale. **Do not use.**

### NEWS — a real feed, added 2026-09-03

`<link rel="alternate" type="application/rss+xml" href="https://omarchy.org/news/rss.xml">`
is declared in the page head. RSS 2.0 with `atom:`, `content:` and `dc:`
namespaces; each `<item>` carries `title`, `link`, `guid`, `pubDate`,
`<dc:creator>`, a CDATA `<description>` summary and a full-text
`<content:encoded>`. That maps onto the snapshot's H3 + KV Date + P summary +
A "Read more" exactly.

Every other feed path is 404 (`/feed`, `/news.xml`, `/feed.xml`, `/rss`,
`/atom.xml`, `/news/index.xml`, `/feed.json`, `/sitemap.xml`). The markdown
behind the posts also exists at
`omacom/omarchy-site/content/news/YYYY/MM/slug.md` with YAML front matter, but
it is in the unlicensed repo and the feed is both easier and more official, so
the feed wins. The feed is three days old, which is the one thing arguing
against it; `article.news-card` on the index page is the documented fallback.

### MEETUPS — Luma, via its public API

`https://omarchy.org/meetups/` carries **no event data at all**: just an
iframe and the nine community rules. The events live on Luma, and the calendar
id is in the iframe's `src`:

```html
<iframe
  class="meetups__embed"
  src="https://luma.com/embed/calendar/cal-SDGGMsEps9ExsrT/events?lt=dark"
></iframe>
```

The adapter reads that id out of the page rather than hardcoding it, then calls:

```
https://api.lu.ma/calendar/get-items?calendar_api_id=<id>&period=future&pagination_limit=100
```

200, no auth, no special headers, `has_more:false` at 43 future entries. Each
entry gives `event.name`, `start_at`, `end_at`, `timezone` (IANA),
`event.url` (slug), `geo_address_info.{city,country}`, `hosts[].name`,
`registration_availability` and `waitlist_active` — everything the snapshot's
H3 + KV Date/Time/Host/Location(/Status) + A needs.

An ICS feed also works and is the fallback:
`https://api.lu.ma/ics/get?entity=calendar&id=<id>` (59 VEVENTs). Two traps
if you use it: `STATUS` is `TENTATIVE` on **every** event, so it carries no
information, and `DTSTAMP`/`SEQUENCE` change on every request, so the bytes
never compare equal. The JSON has neither problem, hence `luma` over `ics`.

Never scrape `luma.com/omarchy` HTML — the same payload sits in
`__NEXT_DATA__`, but that is a Next.js implementation detail.

### AIR, SECURITY, TEAMS, PATRONS, SPONSORS — rendered HTML only

Honestly: there is no machine-readable source for these five. No JSON, no
feed, no microdata, not one `data-*` attribute anywhere on the site. CSS
selectors are the only handle we have.

What makes it tolerable is that the markup is disciplined BEM, semantic, and
committed to a public repo so renames are visible as diffs:

```
body > main.main > div.<page>          e.g. div.air, div.teams, div.sponsorships
header.header > h1                     the page title
```

- **AIR** — `.air`: `p.air__lede`, `section.air__section` (h2), `article.resident`
  (`h3.resident__name > a`, then a bio `p`), `p.air__note`, `ul.air__perks > li`.
- **SECURITY** — `.security`: `section.security__intro` and five
  `section.security__section`, each an h2 with paragraphs and an optional `ul`.
  Pure prose; the generic walker handles it with no per-page rules.
  (`https://omarchy.org/.well-known/security.txt` is genuinely machine-readable
  RFC 9116, but it holds a contact address, not the page's copy.)
- **TEAMS** and **PATRONS** share markup exactly: `section.team[id]` with
  `h2.team__name`, `p.team__description`, then `article.member` with
  `h3.member__name > a` and `p.member__meta`. `member__meta` is a country on
  /teams/ and a company on /patrons/, and it is **absent** for several
  corporate patrons — the adapter emits a KV only when both halves are present.
- **SPONSORS** — `/sponsors/` is 404; the page is `/sponsorships/`.
  `section.sponsorship[id]` with `h2.sponsorship__name`,
  `p.sponsorship__terms` (the tier) and `p.sponsorship__body`.

Fragility: medium. A class rename breaks a page silently-ish — the sync
reports an empty or shrunken page and refuses to overwrite it (see the
`minNodes` guard in `sources.json`).

### WORKSTATIONS — deliberately not synced

`div.workstations` is 80 `button.workstations__image > figure > img` and a
lightbox `dialog`. No captions, no alt text, no attribution: the only datum in
the page is an image URL. There is nothing a 40-column text screen can print,
which is precisely what the current hand-written snapshot says. It stays
`"adapter": "static"` with a `reason`, and the sync leaves it alone.

## Open questions for the owner

1. **Licence.** The manual is MIT; the rest of omarchy.org is a public repo
   with no LICENSE. Worth asking DHH for an explicit grant, or at least a nod,
   before this ships as an automated weekly pull.
2. **Where does the canonical content settle?** If the news markdown or the
   page copy moves into a licensed repo, NEWS becomes `github-markdown` and the
   five HTML pages could follow. That is a one-line change per page in
   `sources.json` plus, at most, one new adapter.
3. **The manual branch.** `quattro` is the current default and will change at
   the next major. The adapter resolves the default branch at runtime, but if
   the manual ever moves out of the OS repo we need a new URL.
4. **The Luma calendar id** is read from the meetups page. If the iframe is
   ever replaced with a client-rendered widget, the id must be configured
   explicitly in `sources.json`.
