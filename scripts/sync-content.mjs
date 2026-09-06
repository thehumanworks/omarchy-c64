#!/usr/bin/env node
/* Keep content/pages/*.json in step with omarchy.org.
 *
 *   npm run sync                 fetch every page and rewrite what changed
 *   npm run sync:check           dry run; exits 1 if anything would change
 *   npm run sync -- --only NEWS  one page
 *   npm run sync -- --menu       also refresh content/menu.json's URLs
 *
 * The design is source-agnostic on purpose: the owner expects omarchy.org's
 * canonical content to move. One adapter per kind of source lives in
 * scripts/sync/adapters/, `content/sources.json` says which page uses which,
 * and the node tuples in between never change. Moving a page to a new source
 * is a one-line edit in sources.json, or one new adapter file.
 *
 * See docs/CONTENT-SOURCES.md for where each page's content actually lives. */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from './sync/write.mjs';
import { createDeps } from './sync/fetch.mjs';
import { syncPage, report } from './sync/run.mjs';
import { summarisePage } from './sync/diff.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { dryRun: false, menu: false, only: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '-n') args.dryRun = true;
    else if (arg === '--menu') args.menu = true;
    else if (arg === '--only') args.only.push(...String(argv[(i += 1)] ?? '').split(','));
    else if (arg.startsWith('--only=')) args.only.push(...arg.slice(7).split(','));
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`sync: unknown argument "${arg}"`);
  }
  args.only = args.only.map((k) => k.trim().toUpperCase()).filter(Boolean);
  return args;
}

const HELP = `Usage: node scripts/sync-content.mjs [options]

  -n, --dry-run     report what would change without writing; exit 1 if anything would
      --only KEY    sync only these pages (comma-separated, repeatable)
      --menu        also refresh content/menu.json URLs from sources.json
  -h, --help        this message
`;

/**
 * The menu's labels, order and block counts are editorial: they are the C64's
 * own palette and reading order, not omarchy.org's. Only the URLs are derived,
 * and only when explicitly asked for with --menu.
 *
 * `content/menu.json` is a bare array of `{label, url, blocks}`; the five
 * entries with no page of their own (ISO, PLUGINS, GITHUB, DISCORD, MERCH)
 * have no source and are passed through untouched.
 */
async function syncMenu(sources, { dryRun }) {
  const file = join(ROOT, 'content/menu.json');
  const menu = await readJson(file);
  if (!Array.isArray(menu)) {
    return { key: 'menu.json', ok: false, error: 'content/menu.json is missing', lines: [] };
  }
  const entries = menu.map((entry) => {
    const source = sources.pages[entry.label];
    // `page` is the human-facing URL for a source that is machine-readable
    // elsewhere: NEWS syncs from rss.xml, but the menu must open /news/. The
    // content unit test asserts these match the page files, so they are
    // derived from exactly the same field the page writer uses.
    const url = source && (source.page ?? source.url);
    return url ? { ...entry, url } : entry;
  });
  const { changed } = await writeJson(file, entries, { dryRun });
  return {
    key: 'menu.json',
    ok: true,
    changed,
    lines: changed ? ['menu.json: URLs refreshed'] : [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void process.stdout.write(HELP);

  const sources = await readJson(join(ROOT, 'content/sources.json'));
  if (!sources?.pages) throw new Error('sync: content/sources.json is missing or has no "pages"');

  const keys = Object.keys(sources.pages).filter((k) => !args.only.length || args.only.includes(k));
  const unknown = args.only.filter((k) => !sources.pages[k]);
  if (unknown.length) throw new Error(`sync: no source for ${unknown.join(', ')}`);

  const deps = createDeps({ token: process.env.GITHUB_TOKEN });
  const results = [];
  for (const key of keys) {
    // Sequential on purpose: nine polite requests a week, not a thundering herd.
    results.push(
      await syncPage(key, sources.pages[key], { root: ROOT, deps, dryRun: args.dryRun }),
    );
  }
  if (args.menu) results.push(await syncMenu(sources, args));

  const { text, failed, changed } = report(results, args);
  process.stdout.write(`${text}\n`);
  if (failed) process.exitCode = 1;
  else if (args.dryRun && changed) process.exitCode = 1;
}

export { parseArgs, summarisePage };

// A bad flag or a missing sources.json is a usage error, not a crash: say what
// is wrong on one line rather than printing a stack trace at someone.
try {
  await main();
} catch (err) {
  process.stderr.write(`${err.message}\n\n${HELP}`);
  process.exitCode = 2;
}
