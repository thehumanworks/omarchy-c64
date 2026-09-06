/* Shared helpers for the sync suites. Nothing here touches the network:
 * `fixture()` reads from test/fixtures/sync and `stubDeps()` hands adapters a
 * lookup table instead of `fetch`, which is the whole reason adapters take
 * their I/O as `deps`. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/sync');

/** Read a fixture file as text. */
export const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8');

/** Read a fixture file as JSON. */
export const fixtureJson = (name) => JSON.parse(fixture(name));

/**
 * Build a `deps` whose fetches are answered from `routes`, keyed by a
 * substring of the URL. An unmatched URL throws, so a test can never
 * accidentally reach the internet.
 */
export function stubDeps(routes, current) {
  const find = (url) => {
    const hit = Object.keys(routes).find((k) => url.includes(k));
    if (!hit) throw new Error(`no stub route for ${url}`);
    return routes[hit];
  };
  return {
    calls: [],
    async fetchText(url) {
      this.calls.push(url);
      const value = find(url);
      return typeof value === 'string' ? value : JSON.stringify(value);
    },
    async fetchJson(url) {
      this.calls.push(url);
      const value = find(url);
      return typeof value === 'string' ? JSON.parse(value) : value;
    },
    async readCurrent() {
      return current;
    },
  };
}

/** Every node of a given kind, as flat strings, for terse assertions. */
export const kinds = (nodes, kind) => nodes.filter((n) => n[0] === kind).map((n) => n.slice(1));
