# Development

[Architecture](ARCHITECTURE.md) maps the code. This guide owns setup, checks
and proof; [Debugging](DEBUGGING.md) owns failure investigation.

## Setup

From the repository root with [mise](https://mise.jdx.dev) installed:

```sh
mise install
mise run setup
```

`mise.toml` and `mise.lock` select tools; `package-lock.json` locks npm packages.
Setup runs `npm ci`, installs Playwright Chromium and installs hk git hooks.
CI installs Node through the same Mise configuration. If your shell has not
activated Mise, run commands through `mise exec --`, for example
`mise exec -- npm run check`. No production credentials are needed to build
or test. Dependency/browser installation needs network access; verification
uses committed content and local fixtures, without contacting content sources.

## Commands

Run these from the repository root:

| Command                                       | Purpose                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                                 | Watch/rebuild and serve `dist/` on port 8000                                 |
| `npm run build`                               | Produce the self-contained `dist/index.html`                                 |
| `npm run lint`                                | ESLint correctness, complexity, layer boundaries, cycles; zero warnings      |
| `npm run format:check`                        | Check Prettier formatting                                                    |
| `npm run lint:fix`                            | Apply ESLint fixes; review the diff                                          |
| `npx --no-install prettier --write PATH...`   | Format only the files you changed                                            |
| `npm run format`                              | Format the whole tree; use only when that scope is intended                  |
| `npm run test:unit`                           | Node tests for core, content, architecture, CI planner and importer fixtures |
| `npm run test:build`                          | Build a temporary page and assert bundle/fallback/license invariants         |
| `npm run test`                                | Unit and build tests; does not require an existing `dist/`                   |
| `npm run test:e2e`                            | Playwright against `dist/index.html`; build first                            |
| `npm run test:e2e:ui`                         | Interactive Playwright runner; build first                                   |
| `npm run test:e2e:update`                     | Replace visual goldens; only for intended appearance changes                 |
| `npm run check`                               | lint → format → unit/build tests → bundle → full e2e                         |
| `npm run ci:plan -- --base origin/main`       | Print conservative affected-check selection                                  |
| `npm run check:changed -- --base origin/main` | Execute that plan; see [CI](CI.md)                                           |
| `npm run sync -- --help`                      | Optional manual import commands; see [Content](CONTENT.md)                   |

`mise run check` and `mise run sync` are aliases. Imported content is never a
freshness requirement. Do not run the importer to repair an unrelated test.

## Hooks and tooling checks

`hk.pkl` defines pre-commit checks: Prettier, ESLint, actionlint, Pkl,
gitleaks, and unit/build tests. Globs select relevant files. Pre-commit stashes
unstaged work, runs fixers in order (ESLint before Prettier), and re-stages the
result. Pre-push builds and runs the complete browser suite.

```sh
hk check           # run check steps without committing
hk fix             # apply configured fixers; review their diff
```

Never use `--no-verify` or lint-disable comments. There is no network content
hook or offline content-hook exception. Hook tools/Pkl packages must already
be installed/cached for offline work.

For workflow or hook changes, also validate the tools `npm run check` does
not cover:

```sh
actionlint
pkl eval hk.pkl > /dev/null
mise tasks
gitleaks dir . --redact --no-banner
```

The secret scan must remain redacted in logs and handoff evidence. Local
credential-dependent publishing commands use `fnox run --`; see
[Deployment](DEPLOYMENT.md). Do not load credentials for ordinary checks.

## Required proof

Run `npm run check` after integrating a change. It creates the build used by
the browser suite, so a stale `dist/` cannot supply false proof. During work,
use a focused unit/spec command from [Debugging](DEBUGGING.md) for feedback.
Affected checks in CI do not replace the full local handoff proof.

For scene/shader/asset changes, open the resulting screenshots and confirm the
monitor still looks right. For input changes, inspect the relevant desktop or
phone images. For copy changes, open the affected page on the tube. Existing
visual tolerances and assertions must not be weakened to accept refactoring.

Only when appearance is intentionally changed:

```sh
npm run build
npm run test:e2e:update
```

Inspect the changed PNGs and explain why they changed. Do not update a golden
just to turn a failed check green. [E2E guide](../test/e2e/README.md) owns the
suite map, diagnostic hook, software WebGL configuration and screenshot helpers.

Report commands and result summaries, with relevant output and inspected image
paths. Separate local tests, browser emulation, physical devices, hosted CI
and deployment. State skipped/failed checks and their reason explicitly.
