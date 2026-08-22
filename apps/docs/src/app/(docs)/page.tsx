import type { ReactElement } from "react";

import type { Metadata } from "next";
import Link from "next/link";

import { COMPONENT_NAV } from "../../lib/nav";

export const metadata: Metadata = {
  title: "Overview",
};

export default function DocsHomePage(): ReactElement {
  return (
    <>
      <h1>elmera/ui</h1>
      <p className="DocsLede">
        Workspace docs app that consumes <code>@elmeragroup/ui</code> through the same public subpaths a real
        consumer would write. Component pages are thin MDX shells; demo frames, API tables and the
        tokens-consumed list are generated from library source at docs build.
      </p>
      <ul className="DocsList">
        {COMPONENT_NAV.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
