# Development

How to set the repository up, what each command proves, and what counts as
proof that a change works. Read [ARCHITECTURE.md](ARCHITECTURE.md) first for
what the code is; this file is about the machinery around it.

## Setup

Tooling is managed by [mise](https://mise.jdx.dev). Two commands from a fresh
clone:

```sh
mise install     # node 26, hk, pkl, actionlint, gitleaks, wrangler, fnox, 1password
mise run setup   # npm ci && npx playwright install chromium && hk install
```

`mise install` reads [`mise.toml`](../mise.toml), which is the single source of
truth for tool versions — CI installs from the same file. `mise run setup`
installs the npm dependencies from `package-lock.json`, downloads the headless
Chromium that the e2e suite uses, and installs the git hooks.

Secrets (Cloudflare) come from 1Password via `fnox run -- <command>`; you only
need them to deploy by hand. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Commands

Every command is an npm script. Use them; do not invent ad-hoc invocations.

| Command                | What it does                                         | What it proves                                                                                                        |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | esbuild in watch mode with a local server            | Nothing. It is the feedback loop, not evidence.                                                                       |
| `npm run build`        | Bundles `src/` and inlines it into `dist/index.html` | The page still builds into one self-contained file.                                                                   |
| `npm run lint`         | `eslint . --max-warnings 0`                          | No correctness smells, no import cycles, and every file within the size limits (300 lines / 80 per function).         |
| `npm run lint:fix`     | eslint with `--fix`                                  | — (a fixer, not a check)                                                                                              |
| `npm run format`       | `prettier --write .`                                 | — (a fixer, not a check)                                                                                              |
| `npm run format:check` | `prettier --check .`                                 | The tree is formatted; diffs stay about behaviour.                                                                    |
| `npm run test:unit`    | `node --test test/unit/**`                           | The pure modules (text buffer, wrapping, commands, case maths) behave.                                                |
| `npm run test:build`   | `node --test test/build/**`                          | `dist/index.html` holds its invariants: one file, everything inlined, no external loads.                              |
| `npm run test`         | unit + build                                         | The fast suite. Seconds, no browser.                                                                                  |
| `npm run test:e2e`     | `playwright test` against `dist/index.html`          | The real page boots in headless Chromium with software WebGL, and the tube shows what it should. Needs a build first. |
| `npm run sync`         | Pulls page copy from `content/sources.json`          | `content/pages/*.json` match omarchy.org today. See docs/CONTENT.md.                                                  |
| `npm run sync:check`   | The same, dry run; exits 1 if anything would change  | The committed content is in step with the sources.                                                                    |
| `npm run check`        | lint → format:check → test → build → test:e2e        | Everything. This is the gate.                                                                                         |

`mise run check`, `mise run sync` and `mise run sync:check` are thin aliases for
the npm scripts of the same name, so `mise tasks` lists everything worth running
from a fresh clone without reading `package.json` first.

### Sync flags

`npm run sync` takes flags after `--`:

| Flag              | Effect                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `-n`, `--dry-run` | report what would change, write nothing, exit 1 if anything would |
| `--only KEY`      | sync only these pages (comma-separated, repeatable)               |
| `--menu`          | also refresh `content/menu.json`'s URLs                           |
| `-h`, `--help`    | usage                                                             |

Set `GITHUB_TOKEN` to lift the GitHub API rate limit when syncing MANUAL. The
sync never needs a secret otherwise: every source is public.

## Git hooks

Hooks are managed by [hk](https://hk.jdx.dev); the configuration is
[`hk.pkl`](../hk.pkl). `mise run setup` (or `hk install`) installs them.

**pre-commit** — fixes what it can and re-stages the result. Unstaged work is
stashed first, so the hooks judge exactly what you are committing:

| Step            | Scope                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `prettier`      | every file prettier understands, minus `.prettierignore`                                                               |
| `eslint`        | `src/**`, `build/**`, `test/**`, `scripts/**`, `*.config.js` — with `--max-warnings 0`                                 |
| `actionlint`    | `.github/workflows/*.yml`                                                                                              |
| `pkl`           | `*.pkl` (so `hk.pkl` itself keeps evaluating)                                                                          |
| `gitleaks`      | the whole tree — a credential can land anywhere                                                                        |
| `unit-tests`    | `npm run test` when JS, content or `package.json` changed                                                              |
| `content-fresh` | `npm run sync:check` when `content/pages/**`, `content/menu.json`, `content/sources.json` or `scripts/sync/**` changed |

Each step is scoped by glob, so a commit that only edits a workflow file does
not run eslint or the test suite.

`content-fresh` is check-only, in `pre-commit` and in `hk check` but not in
`hk fix`: the repair is `mise run sync`, which rewrites editorial copy, and copy
is not something a hook may change behind you. It is also the only step that
needs the public internet — see below.

### Working offline

`content-fresh` talks to omarchy.org, github.com and lu.ma. On a plane, skip
that one step by name with hk's own mechanism:

```sh
HK_SKIP_STEPS=content-fresh git commit -m "..."
HK_SKIP_STEPS=content-fresh hk check      # same, without committing
hk check -S eslint -S prettier            # or: run only the steps you want
```

`HK_SKIP_STEPS` takes a comma-separated list of step names and skips exactly
those; every other hook still runs, which is the whole point. `hk check`'s
`--step/-S` flag is the positive form of the same idea.

**This is the only sanctioned bypass, and it is not `--no-verify`.** `git commit
--no-verify` turns off prettier, eslint, gitleaks and the unit suite as well,
and is forbidden. Re-run `hk check` once you are back on the network.

**pre-push** — the expensive proof, run once per push instead of once per
commit: `npm run build`, then `npm run test:e2e` against the freshly built
page.

Run the same steps by hand, without committing:

```sh
hk check   # read-only: reports problems, changes nothing
hk fix     # writes: prettier and eslint --fix repair what they can
```

`hk fix` then `hk check` is the fastest way to get a tree clean.

**Never use `--no-verify`.** The hooks are the cheapest place to catch a
regression, and a bypassed hook just moves the failure into CI or, worse, into
production. If a hook is wrong, fix `hk.pkl`.

## End-to-end tests and visual goldens

The e2e suite runs against the built file, so build first:

```sh
npm run build
npm run test:e2e                              # whole suite
npx playwright test test/e2e/boot.spec.js     # one file
npx playwright test --headed                  # watch it happen
npx playwright show-report                    # after a failure
```

What each suite proves:

| Suite                | What it proves                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boot.spec.js`       | WebGL starts, no errors, the loader goes away, the `.sr` fallback nav is intact                                                                                                                |
| `fallback.spec.js`   | with WebGL denied the body fails over to the fourteen plain links                                                                                                                              |
| `menu.spec.js`       | the tube's text: the menu, one doc, `HELP`, `POKE`, `SYS 64738`                                                                                                                                |
| `pointer.spec.js`    | hardware hover labels, clicking a menu row, a third-party entry opening a tab                                                                                                                  |
| `responsive.spec.js` | the grid reflows: narrow and tall on a phone, forty columns when wide                                                                                                                          |
| `content.spec.js`    | one test per first-party page: it opens by number, shows its title and first heading, every `A` node becomes a hit box, `End`/`Home`/`Escape` behave                                           |
| `navigation.spec.js` | Tab cycles the selection, a label and a three-letter prefix open the right doc, `HELP`/`ABOUT`/`LIST`/`DIR`/`RUN`, syntax errors, a shortcut's new tab, the power switch and the BRIGHT knob   |
| `layout.spec.js`     | six viewports from a phone to 2560 wide: clean boot, the grid within its limits, no row wider than the tube, the menu box whole, the prompt and ticker on screen — plus the two tablet goldens |
| `visual.spec.js`     | golden screenshots at desktop, phone and ultrawide                                                                                                                                             |

`content.spec.js`, `navigation.spec.js` and `layout.spec.js` import
`src/content/index.js` directly — it is a pure module — so their expectations
are derived from `content/*.json` rather than copied out of it. Editing the copy
does not mean editing the tests. The shared tables live in
`test/e2e/helpers/content.js`, and `test/e2e/helpers/tube.js` converts an
expected string into what the character ROM can actually draw (`asTube`), which
is why `X86_64` is asserted as `X86·64`.

Failures leave `playwright-report/` and `test-results/` behind, with the actual
/ expected / diff images for any visual assertion. CI uploads both directories
as artifacts when a run fails.

Screenshot goldens are **committed to the repository** — that is what makes a
rendering regression visible in a diff. When a change is _supposed_ to alter
what the screen looks like:

```sh
npm run build
npx playwright test --update-snapshots
git add test/e2e/__screenshots__
```

Then **look at the new images before committing them**. `--update-snapshots`
will happily bless a broken render; the only thing standing between a bug and
`main` is a human or agent actually opening the PNG. Say in the commit message
why the picture changed.

## The proof standard

No change is done until it is proved. For any change:

1. `npm run lint` and `npm run format:check` are clean.
2. `npm run test` is green.
3. `npm run build` succeeds.
4. `npm run test:e2e` is green against that build.

`npm run check` runs all four in order — running it once is the whole standard.

Additionally, for **scene or shader changes** (`src/scene/**`, any GLSL, the
CRT or post-processing pipeline, the case geometry): the visual e2e tests are
the only thing that can see the change, so run them and _open the screenshots_.
A shader edit that leaves every test green and the screen subtly wrong is the
characteristic failure of this codebase. Report what you looked at.

For **content changes** (`content/*.json`), the unit suite covers wrapping and
layout; still build and take a look at the page — copy that is one character
too wide for 40 columns is a rendering bug, not a typo.

Do not claim a result you did not run. "Should work" is not a proof.
