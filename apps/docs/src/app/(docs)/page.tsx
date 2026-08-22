import type { ReactElement } from "react";

import type { Metadata } from "next";
import Link from "next/link";

import { NAV_GROUPS } from "../../lib/nav";
import { HOME_PAGE } from "../../lib/pages";

export const metadata: Metadata = {
  title: "Overview",
  description: HOME_PAGE.description,
};

export default function DocsHomePage(): ReactElement {
  return (
    <>
      <h1>elmera/ui</h1>
      <p className="DocsLede">
        The Elmera Group design system: one themed React component library covering six brands, two customer
        segments and two variants — twenty legal themes — without forking a component. Docs pages are thin
        authored shells; demo frames, API tables and the tokens-consumed lists are generated from library
        source at docs build.
      </p>
      {NAV_GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className="DocsGroupHeading">{group.label}</h2>
          <ul className="DocsList">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
