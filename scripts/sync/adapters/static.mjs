/* Adapter: "this page has no source worth syncing — keep the file as it is."
 *
 * Not a stub. It is how a page opts out honestly and visibly: `sources.json`
 * must give a `reason`, the sync reports the page as skipped rather than
 * pretending it succeeded, and the committed snapshot is returned unchanged so
 * a dry-run shows no phantom diff. WORKSTATIONS is the only user today: the
 * page is eighty photographs with no captions and no alt text. */

export async function fetchNodes(source, deps) {
  if (!source.reason) throw new Error(`sync: static source for ${source.url} needs a "reason"`);
  const current = await deps.readCurrent();
  if (!current) throw new Error(`sync: static source has no committed snapshot at ${source.url}`);
  return { title: current.title, url: current.url, nodes: current.nodes, skipped: source.reason };
}
