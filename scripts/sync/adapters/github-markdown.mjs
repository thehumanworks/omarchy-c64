/* Adapter: build a page from markdown files in a GitHub repo.
 *
 * This is the manual, and it is the only source with a real licence (MIT, in
 * `omacom/omarchy`). The page reproduces the tube's existing shape: the lede
 * chapter's prose, then a "Contents" list of every chapter title.
 *
 * Source options:
 *   `repo`    "owner/name"
 *   `branch`  fallback only — the default branch is resolved at runtime,
 *             because it is `quattro` today and was something else for v3
 *   `dir`     directory of `NN-slug.md` chapters
 *   `lede`    chapter filename whose prose opens the page
 *   `contentsHeading`  heading text above the chapter list
 *   `readMore` label for the trailing link to `url`
 */
import { nodesFromMarkdown, inlineText } from '../markdown.mjs';
import { normaliseNodes } from '../normalise.mjs';

const API = 'https://api.github.com';

/** Resolve the repo's default branch, falling back to the configured one. */
async function resolveBranch(source, deps) {
  try {
    const repo = await deps.fetchJson(`${API}/repos/${source.repo}`);
    return repo.default_branch ?? source.branch;
  } catch {
    return source.branch;
  }
}

/** List `dir` in the repo, newest tree, sorted by the `NN-` filename prefix. */
async function listChapters(source, deps, branch) {
  const url = `${API}/repos/${source.repo}/contents/${source.dir}?ref=${branch}`;
  const entries = await deps.fetchJson(url);
  return entries
    .filter((e) => e.type === 'file' && /\.md$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

const rawUrl = (source, branch, path) =>
  `https://raw.githubusercontent.com/${source.repo}/${branch}/${path}`;

/** The first `# Heading` in a chapter, or its slug prettified. */
export function chapterTitle(markdown, filename) {
  const heading = /^#\s+(.+)$/m.exec(markdown ?? '');
  if (heading) return inlineText(heading[1]);
  return inlineText(filename.replace(/^\d+-/, '').replace(/\.md$/i, '').replace(/-/g, ' '));
}

export async function fetchNodes(source, deps) {
  const branch = await resolveBranch(source, deps);
  const chapters = await listChapters(source, deps, branch);
  if (!chapters.length) throw new Error(`sync: no chapters in ${source.repo}/${source.dir}`);

  const bodies = await Promise.all(
    chapters.map((c) => deps.fetchText(rawUrl(source, branch, c.path))),
  );
  const ledeIndex = Math.max(
    0,
    chapters.findIndex((c) => c.name === source.lede),
  );
  // The lede chapter's own prose, links stripped: the tube shows the manual's
  // opening as flat paragraphs and links out once, at the end.
  const lede = nodesFromMarkdown(bodies[ledeIndex], { links: false });
  const contents = chapters.map((c, i) => ['LI', chapterTitle(bodies[i], c.name)]);

  const nodes = normaliseNodes(
    [
      ...lede,
      ['H2', source.contentsHeading ?? 'Contents'],
      ...contents,
      ['A', source.readMore ?? 'Read the full manual', source.url],
    ],
    { base: source.url, maxParagraph: source.maxParagraph },
  );
  return { title: source.title, url: source.url, nodes };
}
