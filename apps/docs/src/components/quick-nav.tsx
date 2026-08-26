"use client";

import type { ReactElement } from "react";

import { usePathname } from "next/navigation";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

import { tocForPath } from "../lib/nav";

const classNames = {
  root: "hidden min-[60rem]:sticky min-[60rem]:top-docs-header min-[60rem]:block min-[60rem]:h-[calc(100vh_-_var(--spacing-docs-header))] min-[60rem]:px-4 min-[60rem]:py-10 min-[60rem]:text-[0.78rem] min-[60rem]:text-docs-sub",
  scroll: "h-full",
  title: "m-0 mb-[0.6rem] block text-[0.66rem] font-semibold tracking-[0.09em] text-docs-sub uppercase",
  list: "m-0 list-none p-0",
  link: "block py-[0.22rem] text-docs-sub no-underline hover:text-docs-ink focus-visible:rounded-[4px] focus-visible:outline-2 focus-visible:outline-docs-ink focus-visible:outline-offset-2",
} as const;

export function QuickNav(): ReactElement {
  const pathname = usePathname();
  const items = tocForPath(pathname);

  return (
    <nav aria-label="On this page" className={classNames.root}>
      <ScrollArea.Root className={classNames.scroll}>
        {items.length === 0 ? null : (
          <>
            <p className={classNames.title}>On this page</p>
            <ul className={classNames.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <a className={classNames.link} href={`#${item.id}`}>
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
