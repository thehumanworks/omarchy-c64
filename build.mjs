import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const res = path.join(here, 'res');
const read = (p) => fs.readFileSync(p, 'utf8');

const RES = {
  rom: read(path.join(res, 'chargen.b64')),
  monitor: read(path.join(res, 'monitor.b64')),
  keyboard: read(path.join(res, 'keyboard.b64')),
  drive: read(path.join(res, 'drive.b64')),
  floppy: read(path.join(res, 'floppy.b64')),
  art: read(path.join(res, 'art.b64')),
  desk: read(path.join(res, 'desk.b64')),
  speaker: read(path.join(res, 'speaker.b64')),
};

const three = read(path.join(res, 'three.module.min.js'));
const app = read(path.join(here, 'pages.js')) + '\n' + read(path.join(here, 'app.js'));
let html = read(path.join(here, 'index.template.html'));

for (const [tok, val] of [['THREE', three], ['RES', JSON.stringify(RES)], ['APP', app]]) {
  const marker = `/*{{${tok}}}*/`;
  const i = html.indexOf(marker);
  if (i < 0) throw new Error('missing token ' + tok);
  html = html.slice(0, i) + val + html.slice(i + marker.length);
}

if (html.slice(html.indexOf('id="three-src"')).indexOf('</script') !== html.slice(html.indexOf('id="three-src"')).indexOf('</script>\n<script id="om-res"')) {
  // sanity only – three.js must not contain a literal </script
}
const out = process.argv[2] || path.join(here, 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' kB');
