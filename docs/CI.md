# Affected-component verification

`npm run check` remains the unconditional full gate. CI uses the same commands
through a conservative selector, reducing browser work only for explicitly
isolated inputs. No test timing, worker count, retry, assertion or golden is
relaxed.

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

`verify.yml` owns PR checkout, planning, dependency installation and verification.
Chromium is installed only for browser plans. A built page is uploaded only
after its checks pass.

`ci.yml` runs on pull requests, avoiding the previous duplicate branch-push
run. Manual dispatch provides full verification for a branch without a PR.
Same-repository PRs with a built page receive a preview from the checked
artifact; docs/tooling-only changes need no preview. Fork PR verification does
not attempt a credential-dependent deployment.

`deploy.yml` uses exact push selection only if the Actions API confirms that
the exact previous SHA completed this production workflow successfully. This
prevents an earlier failed or unrun change from escaping verification in a
later narrow push. Missing history, unavailable API results and manual
dispatch run full. Production dispatch is restricted to `main`; branch dispatch
uses the CI workflow without publishing. A successful affected docs-only run preserves the prior verified
site and skips deployment; runtime changes deploy the checked artifact.

Previews download `dist` from verification instead of rebuilding. Production
verifies and deploys the same file in one job, avoiding another dependency
installation and artifact transfer. Deployment remains serialized.
Pre-push hooks still build and run all browser tests: their remote revision
metadata has not been established reliably enough to narrow them.

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
pre-push remains full. Only selections with demonstrated savings were retained.
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
