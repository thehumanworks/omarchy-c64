/* The only place the sync touches the network.
 *
 * Adapters receive this as `deps.fetchText` / `deps.fetchJson` and never call
 * global fetch themselves, which is what lets the unit tests run adapters
 * against fixture strings with no network at all. */

const USER_AGENT = 'omarchy-c64-content-sync/1.0 (+https://omarchy.thehuman.sh; manual import)';

/** Retry a fetch a couple of times on 5xx and transport errors. */
async function withRetry(url, init, attempts) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      last = new Error(`sync: ${res.status} ${res.statusText} for ${url}`);
      if (res.status < 500 && res.status !== 429) throw last;
    } catch (err) {
      last = err;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw last;
}

/** Build the `deps` object handed to every adapter. */
export function createDeps({ timeout = 20000, attempts = 3, token } = {}) {
  const request = async (url, extraHeaders) => {
    const headers = { 'user-agent': USER_AGENT, ...extraHeaders };
    if (token && new URL(url).hostname === 'api.github.com') {
      headers.authorization = `Bearer ${token}`;
    }
    return withRetry(url, { headers, signal: AbortSignal.timeout(timeout) }, attempts);
  };
  return {
    async fetchText(url, headers) {
      return (await request(url, headers)).text();
    },
    async fetchJson(url, headers) {
      return (await request(url, { accept: 'application/json', ...headers })).json();
    },
  };
}
