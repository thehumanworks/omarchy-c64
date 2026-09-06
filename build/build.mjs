/**
 * The build: bundle `src/main.js` with esbuild, base64 the files in `assets/`,
 * and inline both plus `site/styles.css` into `site/index.html`.
 * Output is one self-contained `dist/index.html` that also works from file://.
 *
 * Flags: `--watch` rebuilds on change, `--serve` serves dist/ on :8000.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => path.join(root, ...p);
const read = (p) => fs.readFileSync(p, 'utf8');

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.avif': 'image/avif',
};

/** Every file in assets/ as base64: images become data URLs, the rest raw. */
function readAssets() {
  const dir = at('assets');
  const out = {};
  for (const name of fs.readdirSync(dir).sort()) {
    const ext = path.extname(name);
    const key = path.basename(name, ext);
    const b64 = fs.readFileSync(path.join(dir, name)).toString('base64');
    out[key] = MIME[ext] ? `data:${MIME[ext]};base64,${b64}` : b64;
  }
  return out;
}

async function bundle() {
  const result = await esbuild.build({
    entryPoints: [at('src', 'main.js')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    write: false,
    legalComments: 'inline' /* three.js is MIT: its notice must ship */,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

/** Replace the block-comment marker for `token` in the template, or fail loudly. */
export function inline(html, token, value) {
  const marker = `/*{{${token}}}*/`;
  const i = html.indexOf(marker);
  if (i < 0) throw new Error(`site/index.html is missing the ${marker} marker`);
  return html.slice(0, i) + value + html.slice(i + marker.length);
}

export async function build(outFile) {
  const app = await bundle();
  let html = read(at('site', 'index.html'));
  html = inline(html, 'CSS', read(at('site', 'styles.css')));
  html = inline(html, 'RES', JSON.stringify(readAssets()));
  html = inline(html, 'APP', app);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  return html.length;
}

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith('--'));
const out = argv.find((a) => !a.startsWith('--')) || at('dist', 'index.html');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bytes = await build(out);
  console.log('wrote', out, `${(bytes / 1024).toFixed(0)} kB`);

  if (flags.includes('--watch')) {
    const dirs = ['src', 'content', 'site', 'assets'].map((d) => at(d));
    let timer = null;
    for (const dir of dirs) {
      fs.watch(dir, { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            console.log('rebuilt', `${((await build(out)) / 1024).toFixed(0)} kB`);
          } catch (err) {
            console.error(err.message);
          }
        }, 60);
      });
    }
  }

  if (flags.includes('--serve')) {
    const ctx = await esbuild.context({});
    const { hosts, port } = await ctx.serve({ servedir: path.dirname(out), port: 8000 });
    console.log(`serving http://${hosts[0]}:${port}/`);
  }
}
