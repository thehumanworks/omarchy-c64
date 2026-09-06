/* Canonical JSON writer for content/*.json.
 *
 * The sync script and `npm run format:check` must agree byte for byte, so we
 * format through prettier itself with the repo's own config rather than
 * guessing at JSON.stringify's line breaking. That also makes the writer
 * idempotent by construction: formatting formatted output is a no-op. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { format, resolveConfig } from 'prettier';

/** Page fields in the order they must appear in every content/pages/*.json. */
const PAGE_KEYS = ['key', 'title', 'url', 'nodes'];

/** Reorder an object's keys to a fixed order so diffs stay minimal. */
export function orderKeys(obj, keys = PAGE_KEYS) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (out[k] === undefined) out[k] = obj[k];
  return out;
}

/** Serialise a value the way prettier would format the file at `filePath`. */
export async function serialise(filePath, value) {
  const config = (await resolveConfig(filePath)) ?? {};
  return format(JSON.stringify(value), { ...config, filepath: filePath, parser: 'json' });
}

/** Read a JSON file, or return `undefined` when it does not exist. */
export async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

/**
 * Write `value` to `filePath` in canonical form.
 * Returns `{ changed, before, after }` and does not touch the file when the
 * canonical form already matches, so a re-run produces no mtime churn.
 */
export async function writeJson(filePath, value, { dryRun = false } = {}) {
  const after = await serialise(filePath, value);
  let before;
  try {
    before = await readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const changed = before !== after;
  if (changed && !dryRun) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, after, 'utf8');
  }
  return { changed, before, after };
}
