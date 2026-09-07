# Agent entry point

Maintain this archived Commodore 64 edition of the Omarchy website: one
self-contained HTML page, a WebGL Commodore 1702 monitor, and a BASIC-style UI.
Preserve appearance, content, links and behavior unless the task changes them.
The committed content is the site's snapshot; matching today's omarchy.org is
not a requirement.

## Read only what the task needs

1. [README.md](README.md) introduces the product.
2. [CONTRIBUTING.md](CONTRIBUTING.md) owns the shared change workflow.
3. Before editing `src/`, read [Architecture](docs/ARCHITECTURE.md) in full;
   it maps responsibilities, interfaces and enforced dependency boundaries.
4. [Development](docs/DEVELOPMENT.md) owns setup, commands and required proof.

Then read the files you will touch in full. Use these task-specific guides:

| Task                                   | Source of truth                              |
| -------------------------------------- | -------------------------------------------- |
| Investigate a bug or failing check     | [Debugging](docs/DEBUGGING.md)               |
| Edit tube copy, menu or manual imports | [Content](docs/CONTENT.md)                   |
| Diagnose an optional upstream importer | [Source provenance](docs/CONTENT-SOURCES.md) |
| Change touch controls or their artwork | [Mobile controls](docs/MOBILE-CONTROLS.md)   |
| Change check selection or workflows    | [CI](docs/CI.md)                             |
| Transfer hosting, publish or roll back | [Deployment](docs/DEPLOYMENT.md)             |
| Upgrade three.js                       | [Vendor guide](vendor/README.md)             |
| Work on browser tests or goldens       | [E2E guide](test/e2e/README.md)              |

## Working agreement

- Inspect `git status --short` and preserve unrelated work. Follow the user's
  scope, including any restriction on commits, pushes or deployment.
- Keep changes cohesive. Split mixed responsibilities, not files that merely
  reach a line count. Keep useful tests, lint rules and verification recipes.
- No frameworks, runtime code loading or new dependencies without a concrete
  need. `src/main.js` remains the composition root.
- Never bypass hooks or silence lint with `eslint-disable`. Fix the cause or
  update the documented contract and its checks together.
- Complete the proof in Development. Report exact commands, results and gaps;
  a running dev server or a plan is not evidence of a working change.
- Keep credentials out of files and output. Existing credential-dependent
  commands use `fnox run -- <command>`; see Deployment for ownership details.

`CLAUDE.md` points here. Keep shared policy here and in the linked owners,
not in parallel agent-specific copies. There are no repository-local skills;
the focused guides above contain the reusable maintenance recipes.
