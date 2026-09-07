# Affected-component verification

`npm run check` remains the unconditional full gate. CI uses the same commands
through a conservative selector, reducing browser work only for explicitly
isolated inputs. Assertions, screenshot tolerances, retries and one software-WebGL worker per
runner are preserved. State-only keyboard/content checks omit the camera warm-up
that visual and pointer tests still need.

## Commands and change ranges

- `npm run ci:plan -- --base origin/main` prints the PR-style plan.
- `npm run check:changed -- --base origin/main` executes it.
- `npm run ci:plan -- --push-base BEFORE_SHA` inspects an exact push range.
- `npm run check` runs everything, regardless of changed paths.

PRs compare the merge base of the supplied base revision and checked-out HEAD
to HEAD. Pushes compare the exact before revision to HEAD, including removals
and earlier merges in a multi-commit push. Tracked working-tree changes and
untracked, nonignored files are also included for local use. Git paths are
NUL-delimited; renames include both original and destination paths.

Missing refs, discovery errors, an empty change list, deleted selected specs
or a missing mapped suite select the full gate. No argument also means full.
Unknown paths default to full, so a newly introduced component is protected
until its coverage is deliberately mapped and tested.

## Coverage map

Lint and formatting always run over the entire tree. Mixed changes take the
union below; any full input overrides the union.

These checks validate the committed snapshot and local fixtures. They do not
compare content with external websites or import new copy.

| Changed inputs                                                                    | Unit suite | Build invariants and bundle | Browser suites                                                                |
| --------------------------------------------------------------------------------- | ---------- | --------------------------- | ----------------------------------------------------------------------------- |
| Markdown under `docs/`, root README/CONTRIBUTING/AGENTS/CLAUDE, e2e/vendor README | No         | No                          | None                                                                          |
| Manual import scripts, fixtures and unit tests/helpers                            | All        | No                          | None                                                                          |
| Other `test/unit/**/*.test.js`                                                    | All        | No                          | None                                                                          |
| Direct `test/e2e/*.spec.js`                                                       | No         | Yes                         | Changed specs                                                                 |
| `src/input/cursor.js`                                                             | All        | Yes                         | boot, fallback, cursor, pointer, touch, monitor-controls, orientation, visual |
| Everything else                                                                   | All        | Yes                         | All                                                                           |

The cursor is the only narrow runtime mapping. It imports no modules and owns
the sprite and canvas cursor style; main wires it up. Coverage includes its
direct shape/position/visibility tests, pointer dataset interaction, touch and
hardware control consumers, resize/orientation, clean boot/fallback and page
goldens. Shared input handlers and composition remain full.

All other `src/`, content, assets, site HTML/CSS, vendor code, build scripts,
dependency files, workflow/CI scripts, hook configuration, shared test helpers,
goldens and unknown files select full. Adding imports or responsibilities to
the cursor requires reviewing this mapping. Freshness outputs, the advisory
content comparison job and scheduled import PRs have been removed. Manual
import tooling and its offline fixture tests remain.

## Workflow composition

`verify.yml` is shared by PRs, branch dispatch and production:

1. **Fast checks and build** selects the plan, runs lint/format/unit/build checks,
   and uploads one candidate page with its exact check plan. It needs no browser.
2. **Browser shards** download that immutable candidate. Full coverage uses four
   isolated runners with one SwiftShader worker each. `--fully-parallel` enables
   Playwright to partition individual tests across shards, without running
   competing renderers on one runner. Narrow plans use at most the number of
   selected spec files; documentation-only plans create no browser jobs.
3. **Verify** is the aggregate gate. A missing, failed, skipped or cancelled
   required browser job fails the gate. Only after all required jobs pass does
   it publish the `dist` artifact used by preview/production deployment.

Useful commands for investigating the same stages locally:

```sh
npm run ci:prepare -- --full
npm run ci:browser -- --shard 1/4
```

`ci:prepare` writes `.cache/verification/plan.json`. All four shards must pass
for full coverage; running one shard is not complete proof. Each failing hosted
shard uploads its own `playwright-report-N` artifact. `fail-fast: false` keeps
other shards running so one failure does not hide additional diagnostics.
Sharding trades extra runner setup for shorter wall time; it does not promise
lower total compute minutes. Tests must keep their page/context state isolated;
do not add order-dependent shared browser state across cases.

`ci.yml` runs for PRs and manual branch dispatch. Only same-repository PRs with
verified site changes deploy a preview. Branch dispatch verifies without
publishing, and fork PRs do not receive deployment credentials.

`deploy.yml` first requires a successful production run for the exact previous
SHA before allowing narrow push selection. Otherwise it requests full proof.
It then calls `verify.yml` and deploys the checked `dist` artifact. No production
rebuild occurs after verification. Dispatch stays restricted to `main`,
docs-only affected plans skip deployment, and production remains serialized.

## Reuse of local browser proof

`npm run check` and `npm run test:e2e` always run a fresh full browser suite.
A successful unfiltered run records local proof under `.cache/verification/`.
Pre-push still builds, then runs `npm run test:e2e:cached`: it reuses proof only
when all browser inputs match, the last run passed, and the proof is under 24
hours old. Otherwise it runs the complete browser suite.

The SHA-256 fingerprint includes the built page, source/assets/content/vendor,
all tests and scripts, Playwright config, tool/dependency locks, installed
browser metadata, Node/platform/architecture, timezone and relevant execution
environment. Ordinary Git commit metadata is excluded, so committing the exact
bytes already checked does not trigger another expensive run. New/deleted files
within those input trees invalidate proof. Keep this list in
`scripts/ci/browser-proof.mjs` current if browser tests gain inputs elsewhere.

Failures, interrupted runs, input changes during a run, filtered/sharded/UI
runs, snapshot updates, skips, flaky results and malformed records cannot create
reusable full proof. Starting another run invalidates previous proof; a prior
run cannot restore it after a newer failure. Use the npm entry points for
focused runs too, so they update this state:

```sh
npm run test:e2e -- test/e2e/orientation.spec.js
```

To force fresh verification, run `npm run test:e2e` without arguments. This
local cache is an optimization, not CI attestation: hosted CI never reuses it,
and deployment still requires every selected hosted check.

## Benchmarking

Run scenarios serially on the same machine with no other browser tests active:

```sh
node scripts/ci/benchmark.mjs full
node scripts/ci/benchmark.mjs docs
node scripts/ci/benchmark.mjs spec
node scripts/ci/benchmark.mjs cursor
```

Each command executes the actual selected npm commands and reports wall seconds
and exit status. These representative path lists measure selection benefits;
they do not replace revision discovery or the required gate for a real change.
Compare against a fresh `npm run check` baseline on the same host. Local timings
exclude hosted runner startup, npm installation, browser installation and
artifact transfer; the next hosted run is the end-to-end CI confirmation.

## Efficiency evidence (2026-09-07)

The most recent successful hosted Verify job before sharding took **25m21s**
([run 34038816213](https://github.com/thehumanworks/omarchy-c64/actions/runs/34038816213)).
It used an earlier revision, so this is operational context, not a controlled
benchmark of the new code. The local pre-push rerun took **25.2m** with 67 passes
and one 120s orientation timeout; that test then passed in isolation unchanged.

On the same local host, serial before/after samples retained the same assertions:

| Representative test           |  Before |   After |
| ----------------------------- | ------: | ------: |
| Main menu text                | 13.451s |  5.374s |
| HELP command                  | 15.025s |  4.472s |
| NEWS navigation and scrolling | 38.186s | 31.568s |

These are single-run measurements under variable host load, not a promised
whole-suite speedup. A frame-wait experiment did not improve NEWS and was
removed; the existing scroll wait remains. Camera/CRT waits remain for visuals
and geometry. Shard discovery verified **17 + 17 + 17 + 17 = 68** distinct tests,
with no omissions or duplicates.

The final local full gate passed **183 unit tests, 10 build tests and 68 browser
tests** (browser duration **14.3m**). After the fast CI stage rebuilt the same
page, `/usr/bin/time -p npm run test:e2e:cached` reused that complete proof in
**1.03s**. Hosted wall-time must still be measured on a real run; shard counts
alone are not a hosted performance result.

## Measured results (2026-09-06)

A clean `main` at `9ea9d5b59ab599e388c6f6d5b69eef2c1e1d1679` ran
`/usr/bin/time -p npm run check` in **377.34 seconds**, with all 66 browser
tests passing. The following serial runs used the integrated changes on the
same host, with no other browser tests active:

| Representative change   | Before: full gate | After: selected gate | Browser tests | Wall-time reduction |
| ----------------------- | ----------------: | -------------------: | ------------: | ------------------: |
| Documentation only      |          377.34 s |               2.81 s |             0 |               99.3% |
| One cursor browser spec |          377.34 s |              57.26 s |             7 |               84.8% |
| Cursor runtime leaf     |          377.34 s |             223.19 s |            36 |               40.9% |

All selected runs exited zero. The cursor run includes the newly added
orientation regression, absent from the baseline's 66 tests. These are
single-run measurements of representative change classes, not a promise for
all changes. Shared runtime/configuration changes still run the full gate;
pre-push was full in this historical measurement. Only selections with demonstrated savings were retained.
The measurements exclude hosted setup and network overhead; removing duplicate
branch-push verification and preview rebuilding reduces redundant CI work
separately from these local timings.

The post-integration full gate also passed: **497.04 seconds**, 165 unit tests,
10 build tests and 68 browser tests. It was not faster than the original full
run, so no full-suite speedup is claimed. The two new orientation regressions
accounted for 25.4 seconds; remaining run-to-run variation was not isolated.
A short serial ABBA rendering comparison found desktop FPS +1.2% and touch FPS
−2.2%, within the observed sample spread; no further rendering optimization was
justified. The retained CI gains come from selecting less work, not faster
rendering or relaxed assertions.

Git revision fixtures run in a hermetic subprocess: inherited Git/hook context
is removed, global/system Git configuration is ignored, and the template is
empty. A sentinel regression checks that outer repository HEAD, index,
configuration, refs and files remain unchanged. This test was added after the
measurements above; it changes no planner or application behavior.
