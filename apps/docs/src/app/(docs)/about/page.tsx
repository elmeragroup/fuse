import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../components/DocsPage";

const HREF = "/about";

export const metadata = pageMetadata(HREF);

export default function AboutPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="what-it-is">What it is</h2>
      <p>
        <code>@elmeragroup/ui</code> is the Elmera Group design system: one React component library that has
        to look right for six brands across two customer segments and two visual variants — twenty legal
        themes in all — without forking a component or shipping twenty bundles.
      </p>
      <p>
        That constraint is the whole design. Components never name a brand. They read tokens, the tokens
        resolve through a small cascade of CSS layers, and the brand is decided by three attributes on a
        single element. Re-theming a subtree is one wrapper, not a second build.
      </p>

      <h2 id="how-it-is-built">How it is built</h2>
      <ul>
        <li>
          <strong>base-ui primitives</strong> underneath, for widget semantics and keyboard behaviour we do
          not want to re-litigate per component.
        </li>
        <li>
          <strong>Tokens, never literals.</strong> Component styles are written against theme tokens, and the{" "}
          <Link href="/handbook/tokens">Tokens</Link> page lists what each component actually reads —
          extracted from the recipe, not hand-maintained.
        </li>
        <li>
          <strong>Server-safe by default.</strong> A component carries <code>&quot;use client&quot;</code>{" "}
          only when it owns interactivity. Every generated API table publishes that status, because it is
          public contract.
        </li>
        <li>
          <strong>Weight is opt-in by architecture.</strong> Per-component subpaths, per-icon exports and
          optional peers, with a CI-enforced ceiling on every published entry.
        </li>
      </ul>

      <h2 id="how-these-docs-work">How these docs work</h2>
      <p>
        Component pages are thin authored shells. Everything below the prose — the demo frames, the API
        tables, the tokens-consumed list, the markdown endpoint — is generated from library source at docs
        build. One authored demo file feeds three consumers: the live stage you see, the visual-regression
        suite, and the <Link href="/handbook/llms-txt">markdown endpoint</Link> an AI reads.
      </p>
      <p>
        Generation is strict on purpose. An unresolvable type or a public prop without a description fails the
        docs build rather than rendering an empty cell, so a table on this site is either correct or absent.
      </p>
      <p>
        The docs chrome is deliberately light-only and unbranded; all the colour on this site lives inside
        demo surfaces. Use the picker in the header to view any demo under any of the twenty themes, or the{" "}
        <Link href="/handbook/theme-matrix">Theme matrix</Link> to see them all at once.
      </p>

      <h2 id="scope">Scope</h2>
      <p>
        The library is a packaged dependency, not copy-paste source: there is no shadcn-style registry, and
        one is a roadmap note only if demand appears. Fonts are never shipped — they are app-supplied through
        theme tokens.
      </p>
    </DocsPage>
  );
}
