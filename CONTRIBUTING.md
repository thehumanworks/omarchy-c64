# Contributing

Humans and AI agents follow the same contribution and proof standards here.
The product is a Commodore 1702 monitor running a 40-column BASIC-style UI,
shipped as one self-contained HTML file. Keep changes focused and preserve its
appearance and behaviour unless the task explicitly changes them.

## Before changing anything

Read [AGENTS.md](AGENTS.md) and [Development](docs/DEVELOPMENT.md), then read
the files you will change in full. Read [Architecture](docs/ARCHITECTURE.md)
in full before editing `src/`; it defines the module boundaries and design
contracts. Check your branch and working tree, and preserve unrelated edits.

From a fresh clone:

```sh
mise install
mise run setup
```

These install the configured toolchain, locked npm dependencies, Chromium and
git hooks. Use the repository's scripts; [Development](docs/DEVELOPMENT.md)
explains each command and the checks selected by hooks and CI.

## Code quality

- Use plain HTML, CSS and ES modules. Keep the build self-contained and usable
  from `file://`, with no framework or runtime code loading.
- Keep modules small: the JavaScript file limit is 300 lines and application
  functions are limited to 80 lines. Split along architecture boundaries;
  never raise limits or add `eslint-disable`. ESLint must pass without warnings
  and Prettier owns formatting.
- Keep the core importable in plain Node without DOM or three.js access at
  import time. Imports flow down the documented layers without cycles;
  `src/main.js` wires layers together.
- Put editorial text in `content/`, not JavaScript. Follow the source rules
  below before editing page snapshots.
- Add a regression test for changed behaviour in the appropriate unit, build
  or browser suite. Update the relevant documentation when a contract changes.
  If code and documented design disagree, follow the design; explain and update
  [Architecture](docs/ARCHITECTURE.md) when the design itself needs to change.

## Changes that need authoritative evidence

### Content and its sources

Read [Content](docs/CONTENT.md), [Content sources](docs/CONTENT-SOURCES.md) and
[`content/sources.json`](content/sources.json). Page snapshots under
`content/pages/` normally come from the configured upstream source. Menu
labels, ordering, block counts and local UI strings are editorial data.

For stale or incorrect page copy, diagnose before writing:

```sh
npm run sync -- --dry-run --only NEWS
```

Replace `NEWS` with the affected page key. If the sync reproduces the incorrect
text, check the upstream source. If extraction fails or loses text, repair the
source configuration or adapter. Do not hand-edit a synced snapshot to hide a
source problem: the next sync overwrites it.

- Refresh with `npm run sync` (or `-- --only KEY`), read the summary and JSON
  diff, then verify the resulting copy on the tube. `--menu` also refreshes
  derived menu URLs; it does not change labels, order or block counts.
- Verify moved URLs, selectors or replacement sources against the actual
  upstream source. Update `content/sources.json` and record the evidence in
  `docs/CONTENT-SOURCES.md`, including attribution and licensing considerations.
- Reuse an existing adapter where possible. New adapters take I/O through
  injected dependencies and need fixture tests under `test/unit/sync/` with
  fixtures in `test/fixtures/sync/`. Preserve the guards against empty or
  unexpectedly shrunken results; investigate failures before changing them.
- Hand-edit a synced page only when its source is down and the change cannot
  wait. Explain that exception in the contribution. If no reliable source
  exists, use `"adapter": "static"` with a documented `"reason"`; a skipped
  static page is not a successful upstream freshness check.

For content changes, run `mise run sync:check` as well as the applicable tests.
The `content-fresh` commit hook also checks changes to source configuration and
adapters. Upstream drift and network failures must be reported accurately;
they do not justify silently replacing authoritative copy.

### Rendering, controls and dependencies

- **Scene and shaders:** for `src/scene/**`, GLSL, case geometry, CRT or
  post-processing changes, run the visual e2e tests and open the PNGs. Say which
  screenshots you inspected. Passing assertions alone cannot establish that
  the monitor still looks right.
- **Intentional visual changes:** build, run `npm run test:e2e:update`, inspect
  the new goldens and explain why they changed in the commit. Never accept new
  screenshots merely to make a failing test pass.
- **Mobile controls:** follow [Mobile controls](docs/MOBILE-CONTROLS.md).
  Navigation uses the physical bezel rocker and Enter button; commands and
  feedback stay on the CRT. Preserve the absence of mobile keyboards, HTML
  command inputs, floating badges, text selection and touch callouts on the
  controls. Run the monitor-controls and touch suites and inspect their phone
  goldens. Report physical-device testing separately from browser emulation.
- **Vendored three.js:** follow [vendor/README.md](vendor/README.md). Use the
  release's ES module build, read back its version, update the vendor record,
  then build, run e2e and compare screenshots. Do not patch or reformat the
  vendored file as application code.
- **Tooling and deployment:** check the actual scripts, `hk.pkl` and workflows
  against [Development](docs/DEVELOPMENT.md) and
  [Deployment](docs/DEPLOYMENT.md). Keep documentation and enforcement in step.

## Prove and submit the change

Use the applicable checks documented in [Development](docs/DEVELOPMENT.md).
The complete local proof remains:

```sh
npm run check
```

This runs lint, formatting, unit and build tests, the bundle, and e2e against
that build. A dev server starting is not proof. Include the commands you ran,
their output and any remaining validation gaps in your PR or agent handoff.
Include visual evidence and source-check results when the change needs them.

Never use `--no-verify`. If a hook is wrong, fix `hk.pkl`. When offline, the
documented exception is to skip only the network-dependent freshness step:

```sh
HK_SKIP_STEPS=content-fresh git commit -m "Describe the change and why"
```

Report the skip and rerun `hk check` when online; all other hooks still apply.

Keep one concern per commit. Explain the problem, resulting behaviour and proof
in the pull request, and link the issue it resolves. Push a branch and open a
PR through the normal workflow; inspect CI and any preview before merging.
Updates to `main` trigger the production workflow described in
[Deployment](docs/DEPLOYMENT.md). Explicit user/session instructions can direct
an agent's workflow; record any authorized exception and its verification gap.

Secrets belong in 1Password locally and repository secrets in CI. Wrap local
commands that need credentials, such as `gh` or `wrangler`, with
`fnox run -- <command>`. Never put secrets in the repository, `.env` files,
logs or contribution evidence.
