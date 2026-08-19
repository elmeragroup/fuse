import type { ReactElement } from "react";

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Overview",
};

export default function DocsHomePage(): ReactElement {
  return (
    <>
      <h1>elmera/ui</h1>
      <p className="DocsLede">
        Workspace docs app that consumes <code>@elmeragroup/ui</code> through the same public subpaths a real
        consumer would write.
      </p>
      <ul className="DocsList">
        <li>
          <Link href="/components/button">Button</Link>
        </li>
        <li>
          <Link href="/components/scroll-area">ScrollArea</Link>
        </li>
      </ul>
    </>
  );
}
