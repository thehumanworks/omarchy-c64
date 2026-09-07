# Contributing

Humans and AI agents follow the same workflow. Start at [AGENTS.md](AGENTS.md)
for the reading map; [Architecture](docs/ARCHITECTURE.md) owns code contracts,
and [Development](docs/DEVELOPMENT.md) owns commands and validation.

## Change workflow

1. Check the branch and working tree. Preserve unrelated changes and follow the
   current user's publishing instructions.
2. Read the relevant guide and affected modules in full. For bugs, reproduce
   and narrow the failing layer using [Debugging](docs/DEBUGGING.md).
3. Make the smallest cohesive change. Add regression coverage for a changed
   behavior or newly enforced contract; avoid tests that merely restate code.
4. Run `npm run check`. For hooks/workflows, also run the tooling checks in
   Development. Inspect screenshots when rendering, controls or assets change.
5. Review the complete diff. Update the owning documentation, and report the
   commands, result summaries, visual evidence and any validation gaps.

When publishing is authorized, use one concern per commit and a branch/PR by
default. Explain the problem, final behavior and proof for a reviewer who has
not seen the conversation. Never use `--no-verify`; fix a broken hook in
`hk.pkl`. Merging to `main` can publish the site through
[Deployment](docs/DEPLOYMENT.md). Do not infer deployment approval from a
request to review or edit code.

## Special proof

- **Tube copy:** edit the committed JSON using [Content](docs/CONTENT.md).
  Upstream imports are optional and may overwrite local copy; they are not a
  prerequisite for a contribution. Validate the content and view it on the tube.
- **Scene, shaders or visual assets:** inspect actual PNGs as well as assertions.
  Keep shader constants, timing, colors and goldens unchanged for refactoring.
  Update goldens only for an intended visual change and explain why.
- **Touch input:** follow [Mobile controls](docs/MOBILE-CONTROLS.md), including
  repeat/cancel and portrait/landscape tests. Report physical-device coverage
  separately from browser emulation.
- **Dependencies:** use locked versions and the [vendor recipe](vendor/README.md)
  for three.js. Do not patch or reformat vendored code.
- **Optional importers:** preserve fixture tests, injected I/O and shrink/empty
  guards. Check the historical provenance before changing a source; do not
  report a static page or an unreachable source as successfully refreshed.

If implementation and documented design disagree, investigate both before
changing either. Fix the implementation when the contract is still right;
otherwise update the contract and its regression coverage in the same change.
