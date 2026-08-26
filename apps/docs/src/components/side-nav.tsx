"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

import { NAV_GROUPS } from "../lib/nav";

const classNames = {
  root: "border-r border-docs-line px-4 pt-6 pb-16 text-[0.82rem] min-[45rem]:sticky min-[45rem]:top-docs-header min-[45rem]:h-[calc(100vh_-_var(--spacing-docs-header))] min-[45rem]:overflow-hidden",
  scroll: "h-auto max-h-48 min-[45rem]:h-full min-[45rem]:max-h-none",
  section: "mb-[1.4rem]",
  heading: "mb-[0.4rem] block pl-[0.6rem] text-[0.82rem] font-[450] text-docs-sub",
  list: "m-0 list-none p-0",
  link: "block rounded-[6px] px-[0.6rem] py-[0.28rem] text-docs-sub no-underline hover:bg-docs-soft hover:text-docs-ink data-active:bg-docs-soft data-active:font-[550] data-active:text-docs-ink focus-visible:outline-2 focus-visible:outline-docs-ink focus-visible:outline-offset-[-2px]",
} as const;

export function SideNav(): ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className={classNames.root}>
      <ScrollArea.Root className={classNames.scroll}>
        {NAV_GROUPS.map((group) => (
          <div className={classNames.section} key={group.label}>
            <div className={classNames.heading}>{group.label}</div>
            <ul className={classNames.list}>
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      className={classNames.link}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      data-active={active || undefined}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </ScrollArea.Root>
    </nav>
  );
}
