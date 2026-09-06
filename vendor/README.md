# vendor/

Third-party code we do not edit. It is committed rather than installed so the
build has no network step and `dist/index.html` is reproducible from a clone.

## three.module.min.js

- **Version: r169** (`Copyright 2010-2024 Three.js Authors`; the build stamps
  `REVISION = "169"` near the top of the file).
- **Licence:** MIT, see the header comment in the file.
- **Why a file and not a dependency:** the page is one self-contained HTML file
  with no runtime loading, so three.js is bundled by esbuild from here. Only
  the handful of classes `src/scene/**` imports survive tree-shaking.

### Upgrading

1. Download the ES module build for the release you want:
   `https://unpkg.com/three@<version>/build/three.module.min.js`
2. Overwrite `vendor/three.module.min.js` with it.
3. Update the version above (read it back from the file header, do not guess).
4. `npm run build && npm run test:e2e`, then compare screenshots against the
   previous build — three.js has changed colour-management and shader-chunk
   defaults between majors, and this page turns off colour management
   explicitly (`THREE.ColorManagement.enabled = false` in
   `src/scene/renderer.js`) precisely because of that.

Do not reformat or lint this file: `eslint.config.js` and `.prettierignore`
both skip `vendor/`.
