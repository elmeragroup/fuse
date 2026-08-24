import { ApiReference } from "./src/components/ApiReference";
import { ComponentIntro } from "./src/components/ComponentIntro";
import { ComponentTokens } from "./src/components/ComponentTokens";
import { Demo } from "./src/components/Demo";
import { MDX_HEADINGS, MdxCode, MdxPre } from "./src/components/MdxElements";
import { Prose } from "./src/components/Prose";

/**
 * The MDX component scope, resolved by `@next/mdx` for every authored `page.mdx`
 * (docs-site.md §1).
 *
 * Two kinds of entry live here:
 *
 *   • **element overrides** — `h2`–`h4` carry the anchor id the QuickNav TOC links to,
 *     and `code`/`pre` highlight fenced blocks with sugar-high (the single highlighter,
 *     §8). Anchors are computed from the heading text with the same `slugifyHeading` the
 *     generator uses for the TOC, so the two cannot drift.
 *   • **the page vocabulary** — the components a component page composes its §3.4
 *     anatomy from. They are in scope everywhere so a page's own imports stay limited to
 *     the thing only that page knows: its demos.
 *
 * Demos are never listed here; a page imports each demo as a plain ESM module (§6).
 *
 * MDX calls this with no arguments and merges a file's own `components` prop over the
 * result, so this scope is the site-wide default rather than the last word.
 */
export function useMDXComponents() {
  return {
    ...MDX_HEADINGS,
    code: MdxCode,
    pre: MdxPre,
    ApiReference,
    ComponentIntro,
    ComponentTokens,
    Demo,
    Prose,
  };
}
