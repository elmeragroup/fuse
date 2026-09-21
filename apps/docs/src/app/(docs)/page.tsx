import type { ReactElement } from "react";

import type { Metadata } from "next";
import Link from "next/link";
import { tv } from "tailwind-variants";

import { DocsLede } from "../../components/docs-lede";
import { DocsPageTitle } from "../../components/docs-page-title";
import { NAV_GROUPS } from "../../lib/nav";
import { HOME_PAGE } from "../../lib/pages";

export const metadata: Metadata = {
  title: "Overview",
  description: HOME_PAGE.description,
};

const docsHome = tv({
  slots: {
    groupHeading: "font-medium text-xs m-[2rem_0_-0.9rem] text-muted-foreground",
    list: "text-sm m-[1.4rem_0_0] list-none p-0 [&_a]:text-foreground [&_a:hover]:text-muted-foreground",
  },
});

const { groupHeading, list } = docsHome();

export default function DocsHomePage(): ReactElement {
  return (
    <>
      <DocsPageTitle>Fuse</DocsPageTitle>
      <DocsLede>
        The Elmera Group design system: one themed React component library covering six brands, two customer
        segments and two variants — twenty legal themes — without forking a component. Docs pages are thin
        authored shells; demo frames, API tables and the tokens-consumed lists are generated from library
        source at docs build.
      </DocsLede>
      {NAV_GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className={groupHeading()}>{group.label}</h2>
          <ul className={list()}>
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
