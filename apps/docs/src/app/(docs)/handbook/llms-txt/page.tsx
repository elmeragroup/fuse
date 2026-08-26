import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { COMPONENT_NAV } from "../../../../lib/nav";

const HREF = "/handbook/llms-txt";

export const metadata = pageMetadata(HREF);

export default function LlmsTxtPage(): ReactElement {
  const first = COMPONENT_NAV[0];

  return (
    <DocsPage href={HREF}>
      <h2 id="the-index">The index</h2>
      <p>
        <a href="/llms.txt">
          <code>/llms.txt</code>
        </a>{" "}
        is a plain-text index of every page on this site with a one-line description of each. It is generated
        at docs build from the same two inventories the sidebar renders — the authored page manifest and the
        component pages found on disk — so a new component page appears in it the moment its{" "}
        <code>page.mdx</code> lands. Nothing in it is written by hand.
      </p>

      <h2 id="markdown-endpoints">Markdown endpoints</h2>
      <p>
        Every component page has a plain-markdown twin at <code>/components/&lt;name&gt;.md</code> containing
        its generated API reference and the verbatim source of every demo. The{" "}
        <strong>View as Markdown</strong> link under each page&apos;s lede points at it.
        {first === undefined ? null : (
          <>
            {" "}
            For example, <Link href={first.href}>{first.label}</Link> has{" "}
            <a href={`${first.href}.md`}>
              <code>{first.href}.md</code>
            </a>
            .
          </>
        )}
      </p>
      <p>
        These are not a second rendering of the docs. The API tables, the RSC status, the tokens-consumed list
        and the demo source in a markdown endpoint come out of the same build pass that renders the HTML page
        — one pipeline with three consumers: the HTML docs you are reading, the visual-regression suite, and
        anything reading markdown.
      </p>

      <h2 id="why-not-a-registry">Why not a registry</h2>
      <p>
        There is no shadcn-style component registry. The library is a packaged dependency, not copy-paste
        source, so a registry would ship a second, forkable copy of components that are meant to be upgraded
        by version bump. It is a roadmap note only if demand appears.
      </p>

      <h2 id="using-it">Using it</h2>
      <p>
        Point a coding assistant at <code>/llms.txt</code> to give it the map, then let it fetch the specific
        markdown endpoints it needs. That keeps the context small and the API details exact — the endpoint
        types are generated from the library&apos;s own source, so they cannot describe a prop the package
        does not have.
      </p>
    </DocsPage>
  );
}
