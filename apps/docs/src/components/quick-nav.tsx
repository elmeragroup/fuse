"use client";

import type { ReactElement } from "react";

import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

import { tocForPath } from "../lib/nav";
import { docsNavListSlots } from "./docs-nav-list";

const quickNav = tv({
  slots: {
    root: "min-[60rem]:top-docs-header min-[60rem]:text-docs-sub hidden min-[60rem]:sticky min-[60rem]:block min-[60rem]:h-[calc(100vh_-_var(--spacing-docs-header))] min-[60rem]:px-4 min-[60rem]:py-10 min-[60rem]:text-[0.78rem]",
    scroll: "h-full",
    title: "font-semibold text-docs-sub m-0 mb-[0.6rem] block text-[0.66rem] tracking-[0.09em] uppercase",
    link: "text-docs-sub hover:text-docs-ink focus-visible:outline-docs-ink block py-[0.22rem] no-underline focus-visible:rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2",
  },
});

export function QuickNav(): ReactElement {
  const pathname = usePathname();
  const items = tocForPath(pathname);
  const { root, scroll, title, link } = quickNav();
  const { list } = docsNavListSlots;

  return (
    <nav aria-label="On this page" className={root()}>
      <ScrollArea.Root className={scroll()}>
        {items.length === 0 ? null : (
          <>
            <p className={title()}>On this page</p>
            <ul className={list()}>
              {items.map((item) => (
                <li key={item.id}>
                  <a className={link()} href={`#${item.id}`}>
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </ScrollArea.Root>
    </nav>
  );
}
