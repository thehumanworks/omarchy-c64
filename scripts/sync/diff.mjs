/* Human-readable diff summaries for the sync report.
 *
 * The point is not a full patch — `git diff` does that better. It is the two
 * or three lines that tell a reviewer, in the PR body, what actually moved. */

const label = (node) =>
  node[0] === 'KV' ? `KV ${node[1]}: ${node[2]}` : `${node[0]} ${node.slice(1).join(' -> ')}`;

const key = (node) => JSON.stringify(node);

/** Compare two node lists as multisets: added, removed, and the totals. */
export function diffNodes(before = [], after = []) {
  const counts = new Map();
  for (const node of before) counts.set(key(node), (counts.get(key(node)) ?? 0) + 1);
  const added = [];
  for (const node of after) {
    const k = key(node);
    const seen = counts.get(k) ?? 0;
    if (seen > 0) counts.set(k, seen - 1);
    else added.push(node);
  }
  const removed = [];
  for (const [k, n] of counts) for (let i = 0; i < n; i += 1) removed.push(JSON.parse(k));
  return { added, removed, before: before.length, after: after.length };
}

/** A capped list of `+ …` or `- …` example lines for one side of the diff. */
function samples(nodes, sign, cap) {
  const lines = nodes.slice(0, cap).map((node) => `  ${sign} ${label(node)}`);
  if (nodes.length > cap) lines.push(`  ${sign} ... ${nodes.length - cap} more`);
  return lines;
}

/** The `title:`/`url:` lines, for the rare page whose metadata moved. */
function fieldLines(before, after) {
  const lines = [];
  if (before?.title !== after?.title) lines.push(`  title: ${before?.title} -> ${after?.title}`);
  if (before?.url !== after?.url) lines.push(`  url: ${before?.url} -> ${after?.url}`);
  return lines;
}

/** One page's diff as a short block of lines. `sample` caps the examples. */
export function summarisePage(pageKey, before, after, sample = 4) {
  const nodes = diffNodes(before?.nodes, after?.nodes);
  const fields = fieldLines(before, after);
  if (!nodes.added.length && !nodes.removed.length && !fields.length) return [];
  return [
    `${pageKey}: ${nodes.before} -> ${nodes.after} nodes ` +
      `(+${nodes.added.length} / -${nodes.removed.length})`,
    ...fields,
    ...samples(nodes.added, '+', sample),
    ...samples(nodes.removed, '-', sample),
  ];
}
