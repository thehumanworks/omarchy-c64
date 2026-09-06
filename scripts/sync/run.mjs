/* The engine behind `scripts/sync-content.mjs`: resolve adapters, run one
 * page, and guard the result before anything is written. */
import { join } from 'node:path';
import { readJson, writeJson, orderKeys } from './write.mjs';
import { summarisePage } from './diff.mjs';

export const PAGES_DIR = 'content/pages';

/* `src/content/index.js` imports each page by a lower-case filename and keys
 * the map by the upper-case `key` inside it. The sync speaks in menu labels,
 * so the filename is derived here and nowhere else. */
const pagePath = (root, key) => join(root, PAGES_DIR, `${key.toLowerCase()}.json`);

/** Load an adapter by name. Adapters are files, so adding one needs no registry. */
export async function loadAdapter(name) {
  try {
    return await import(`./adapters/${name}.mjs`);
  } catch (err) {
    throw new Error(`sync: no adapter "${name}" (${err.message})`, { cause: err });
  }
}

/**
 * Refuse output that looks like a scrape that silently lost its selector.
 * A page shrinking to nothing is the failure mode that would otherwise wipe a
 * good snapshot without anyone noticing until the tube went blank.
 */
export function guard(pageKey, source, result, current) {
  const nodes = result?.nodes ?? [];
  if (!nodes.length) throw new Error(`sync: ${pageKey} produced no nodes`);
  const min = source.minNodes ?? 0;
  if (nodes.length < min) {
    throw new Error(`sync: ${pageKey} produced ${nodes.length} nodes, below minNodes ${min}`);
  }
  const had = current?.nodes?.length ?? 0;
  if (had && nodes.length < had * 0.5) {
    throw new Error(
      `sync: ${pageKey} lost more than half its nodes (${had} -> ${nodes.length}); ` +
        'the source markup probably changed. Check the selectors in content/sources.json.',
    );
  }
  if (!result.title) throw new Error(`sync: ${pageKey} produced no title`);
  return true;
}

/**
 * Sync one page. Never throws: a failure is reported as a result so one dead
 * source cannot stop the other eight or clobber their files.
 */
export async function syncPage(pageKey, source, { root, deps, dryRun }) {
  const file = pagePath(root, pageKey);
  const current = await readJson(file);
  try {
    const adapter = await loadAdapter(source.adapter);
    const pageDeps = { ...deps, readCurrent: async () => current };
    const result = await adapter.fetchNodes({ ...source, key: pageKey }, pageDeps);
    guard(pageKey, source, result, current);
    const next = orderKeys({
      key: pageKey,
      title: result.title,
      url: source.page ?? result.url ?? source.url,
      nodes: result.nodes,
    });
    const { changed } = await writeJson(file, next, { dryRun });
    return {
      key: pageKey,
      ok: true,
      changed,
      skipped: result.skipped,
      lines: summarisePage(pageKey, current, next),
    };
  } catch (err) {
    // The committed file is deliberately left untouched here.
    return { key: pageKey, ok: false, changed: false, error: err.message, lines: [] };
  }
}

/** Render the whole run as the text printed to stdout and pasted into the PR. */
export function report(results, { dryRun }) {
  const lines = [];
  for (const r of results) {
    const status = !r.ok
      ? `FAILED  ${r.error}`
      : r.skipped
        ? `skipped (${r.skipped})`
        : r.changed
          ? dryRun
            ? 'would change'
            : 'updated'
          : 'unchanged';
    lines.push(`${r.key.padEnd(13)} ${status}`);
  }
  const detail = results.flatMap((r) => r.lines);
  if (detail.length) lines.push('', 'Changes:', ...detail);
  const failed = results.filter((r) => !r.ok);
  const changed = results.filter((r) => r.ok && r.changed);
  lines.push(
    '',
    `${changed.length} page(s) ${dryRun ? 'would change' : 'changed'}, ` +
      `${failed.length} failed, ${results.length} total.`,
  );
  return { text: lines.join('\n'), failed: failed.length, changed: changed.length };
}
