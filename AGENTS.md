# AGENTS.md

You are maintaining omarchy.org's Commodore 64 edition: one self-contained HTML
page that renders a Commodore 1702 monitor in WebGL and runs a 40-column BASIC
style UI on its tube. It ships to Cloudflare Pages on every merge to `main`.

This repository is maintained by AI agents. Everything below exists so that an
agent with no memory of previous sessions can make a correct change, prove it,
and ship it without a human in the loop.

## Start here

Read `README.md` for the project overview and `CONTRIBUTING.md` for the shared
human/agent contribution and evidence standards.

1. `docs/ARCHITECTURE.md` — the module map, the layer rules, the key objects.
   Read it in full before editing anything under `src/`.
2. `docs/DEVELOPMENT.md` — commands, hooks, and the proof standard.
3. `docs/CONTENT.md` — how the site's copy is structured, if you are changing
   what the site says.
4. `docs/DEPLOYMENT.md` — Cloudflare Pages, secrets, previews, rollback.

Then read only the files you need. Every file is small on purpose: read a file
in full rather than grepping for a line, and keep it small when you leave.

## Setup

```sh
mise install      # toolchain from mise.toml (node, hk, pkl, wrangler, ...)
mise run setup    # npm ci, headless Chromium, git hooks
```

## The rules

**Keep files small.** Lint enforces 300 lines per file and 80 per function
(`eslint.config.js`). Never raise a limit, never add `eslint-disable`. When a
file grows, split it along the layer boundaries in ARCHITECTURE.md.

**Content is data.** Menu entries, page copy, ticker, hints, help and about
text live in `content/*.json`. If a change is editorial, it touches `content/`
and nothing in `src/`. Code never hard-codes copy.

**Pure core.** `src/text`, `src/content`, `src/screen/text-buffer.js`,
`src/machine`, `src/audio` and the maths in `src/scene/case.js` must import
cleanly in plain Node. No `window`, `document` or three.js at import time
there. This is what makes the unit suite possible; do not break it.

**No cycles, one direction.** Imports point downward through the layers.
`src/main.js` is the only place that wires layers together.

**Plain HTML, CSS and ES modules.** No framework, no server rendering, no
runtime code loading. The build (`build/build.mjs`) produces one
`dist/index.html` with everything inlined; the page works from `file://`.

**Preserve the design.** The look of the monitor, the tube, the boot sequence
and the menu is the product. Do not change shader constants, timings, colours
or copy unless the task is explicitly about them. When it is, take screenshots
and look at them.

**Never bypass the hooks.** `git commit --no-verify` is forbidden. If a hook is
wrong, fix `hk.pkl`.

## Workflow for any change

1. Read the relevant doc and the files you will touch, in full.
2. Make the smallest change that does the job. Put new copy in `content/`,
   new logic in the layer it belongs to, and a test next to it.
3. Prove it:
   ```sh
   npm run check    # lint, format, unit + build tests, bundle, e2e
   ```
   If the change touches `content/`, `mise run sync:check` must also be clean —
   the `content-fresh` hook runs it for you on commit, and offline you skip that
   one step with `HK_SKIP_STEPS=content-fresh`, never `--no-verify`.
   For anything under `src/scene/**` or the shaders, also open the screenshots
   the visual e2e produces (or run `node test/e2e/helpers/shots.mjs`) and
   confirm by eye that the monitor still looks right.
4. If the picture is supposed to change, update the goldens with
   `npm run test:e2e:update`, look at the new PNGs, and say why in the commit.
5. Commit with a message that says what changed and why. One concern per
   commit. Normally push a branch and open a pull request. CI selects affected
   checks conservatively and posts a preview when it builds the site; shared
   or unknown inputs receive the full gate. Main pushes verify against a
   proven baseline and deploy site changes. See `docs/CI.md`; explicit user
   instructions may authorize direct main pushes.

Do not report a change as done without having run the proof. "Should work" is
not a result; paste the command output.

## Recipes

**Add or edit a first-party page shown on the tube.** Edit or create
`content/pages/<KEY>.json` (see `docs/CONTENT.md` for the node kinds), make
sure a `content/menu.json` entry has that label, run `npm run test` (the
content suite validates every page) and `npm run build`, then open the page
and type the entry's number to read it on the tube.

**Add a typed command.** Add a row to the command table in
`src/machine/commands.js` (matcher + handler, side effects through `ctx`),
add its help line to `content/strings.json`, add a case to
`test/unit/machine/commands.test.js`.

**Change what the menu links to.** `content/menu.json`. Labels with a matching
`content/pages/<LABEL>.json` open on the tube; anything else opens a tab.

**Change mobile input.** The bezel rocker and Enter button in
`src/input/monitor-controls.js` handle touch navigation without a keyboard.
Their artwork and projection are documented in `docs/MOBILE-CONTROLS.md`.
Do not add a custom keyboard, HTML command input, KBD toggle or floating hover
badge. Commands and feedback belong on the CRT; physical keyboards still
work. Prove changes with `npx playwright test test/e2e/monitor-controls.spec.js
test/e2e/touch.spec.js` and inspect the `phone-monitor-controls` and
`phone-no-badges` goldens.

**Tweak the CRT look.** `src/scene/shaders/*.js` hold the GLSL, `src/scene/crt.js`
the uniforms and defaults, `src/scene/post.js` the bloom and final grade. Every
change here needs the visual proof above.

**Redraw the retro mouse pointer.** The arrow and hand are pixel-art strings at
the top of `src/input/cursor.js` (`X` fill, `o` outline, `.` transparent) —
edit the rows, keep every row the same length, then run
`npx playwright test test/e2e/cursor.spec.js --update-snapshots` and look at
`test/e2e/__screenshots__/cursor.spec.js/desktop-cursor.png`.

**Update three.js.** See `vendor/README.md`.

**Update news or meetups** (or any other synced page). Run `npm run sync`,
read the diff summary it prints, run `npm run check`, commit `content/`. Do not
hand-edit `content/pages/*.json` unless the source is down and the change
cannot wait, because the next sync overwrites it. `content/sources.json` says
where each page comes from and `docs/CONTENT-SOURCES.md` says why.

**A page's copy looks wrong or stale.** Run `npm run sync -- --dry-run --only
<KEY>` first. If the sync reproduces the wrong text, the upstream page is
wrong. If the sync fails or drops content, the selectors in
`content/sources.json` need updating - not the JSON.

**A source moved.** Change one line in `content/sources.json`: usually `url`,
sometimes `adapter`. Add an adapter under `scripts/sync/adapters/` only for a
kind of source we do not already handle. Record what you found in
`docs/CONTENT-SOURCES.md`.

**A page cannot be sourced.** Set `"adapter": "static"` with a `"reason"` in
`content/sources.json`. The sync keeps the committed snapshot and reports the
page as skipped instead of pretending it succeeded.

## Deployment and secrets

Updating `main` runs `.github/workflows/deploy.yml`: affected checks against a
verified baseline, or the full suite when required, then `wrangler pages deploy`
for a built site to the Cloudflare Pages project `omarchy-website`
(production domain omarchy.thehuman.sh; c63.omarchy.org once DNS is added on
DHH's side, see `docs/DEPLOYMENT.md`).

Secrets are never in the repo or in a `.env` file. Locally they come from
1Password through fnox: wrap any command that needs them, such as `wrangler`
or `gh`, as `fnox run -- <command>`. In CI they are repository secrets.

## When something is unclear

Prefer the documented design over the current code if they disagree, and fix
the code. If the design itself is wrong, change `docs/ARCHITECTURE.md` in the
same pull request and explain why. Leave the tree better documented than you
found it, in the file that a future agent would read first.
