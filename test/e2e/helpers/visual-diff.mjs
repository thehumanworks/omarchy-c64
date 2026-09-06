// usage: node visual-diff.mjs a.png b.png [--out diff.png]
// Prints the ratio of differing pixels between two PNGs of the same size and
// exits 1 above THRESHOLD. The CRT has animated grain, so a small non-zero
// ratio is expected even between two runs of the same build.
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const THRESHOLD = 0.05;

export function diffRatio(fileA, fileB, outFile) {
  const a = PNG.sync.read(fs.readFileSync(fileA));
  const b = PNG.sync.read(fs.readFileSync(fileB));
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const out = new PNG({ width: a.width, height: a.height });
  const differing = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 });
  if (outFile) fs.writeFileSync(outFile, PNG.sync.write(out));
  return { differing, total: a.width * a.height, ratio: differing / (a.width * a.height) };
}

if (import.meta.filename === process.argv[1]) {
  const [a, b] = process.argv.slice(2);
  const i = process.argv.indexOf('--out');
  const r = diffRatio(a, b, i > 0 ? process.argv[i + 1] : null);
  console.log(`${(r.ratio * 100).toFixed(3)}% (${r.differing}/${r.total} px)`);
  process.exit(r.ratio > THRESHOLD ? 1 : 0);
}
