/**
 * The server instructions, which a client loads when it connects. Claude Code reads at most 4,096
 * characters of them. With three skills the text holds about 1,770.
 */

import { HREFS_PER_CALL } from "./read-doc.ts";

/**
 * The server instructions.
 *
 * @param skillUris - The `skill://` URIs this server serves. The text names them for clients that
 *   do not load skills, and names none when there are none.
 * @param docsOrigin - The docs site's origin, which `read_doc` names in its `Source:` lines.
 * @returns The instructions text.
 */
export function instructions(skillUris: readonly string[], docsOrigin: URL): string {
  const lines = [
    `Fuse (\`@elmeragroup/fuse\`) is Elmera Group's React component library. It themes every component for seven brands, two segments, two identities and two densities. This server answers from the Fuse docs at ${docsOrigin.origin}.`,
    "",
    "Use it when you add Fuse to an app, build or change UI with Fuse components, or choose a theme or density. Read the docs before you write Fuse code, because its prop names, part names and imports differ from other libraries.",
    "",
    "How to find an answer:",
    "",
    '1. Call `search_docs` with what you need, such as "button pending" or "pick one option from a list". Each result has an href to the section that matched, such as `/components/button#api-button`.',
    `2. Call \`read_doc\` with up to ${String(HREFS_PER_CALL)} of those hrefs in one call. A fragment returns that section and every section under it. \`#overview\` is the title and lede, \`#usage\` the import and a minimal example, and \`#api-reference\` the whole API reference. An href without a fragment returns the whole page.`,
    "3. A page or section too large for one call comes back as its size and the hrefs of the sections under it. Ask for those you need.",
    "",
    "`read_doc` of `/llms.txt` lists every page with a one-line description. To set Fuse up, read `/quick-start`. Theming is under `/handbook/theming`, and density under `/handbook/density`.",
    "",
    "The docs follow the `main` branch of the Fuse repository, so they can describe props or components that the package installed in a project does not have yet. When the docs and the installed package disagree, the installed package's type definitions are right for that project.",
  ];
  if (skillUris.length > 0) {
    lines.push(
      "",
      "This server ships skills for Fuse work. A client that does not load skills can read them as resources:",
      "",
      ...skillUris.map((uri) => `- ${uri}`)
    );
  }
  return lines.join("\n");
}
