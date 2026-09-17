"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

import { NAV_GROUPS } from "../lib/nav";
import { docsNavList } from "./docs-nav-list";

const sideNav = tv({
  slots: {
    root: "min-[45rem]:top-docs-header text-sm border-r border-border px-4 pt-6 pb-16 min-[45rem]:sticky min-[45rem]:h-[calc(100vh_-_var(--spacing-docs-header))] min-[45rem]:overflow-hidden",
    scroll: "h-auto max-h-48 min-[45rem]:h-full min-[45rem]:max-h-none",
    section: "mb-[1.4rem]",
    heading: "text-sm font-normal mb-[0.4rem] block pl-[0.6rem] text-muted-foreground",
    link: "data-active:font-medium block rounded-lg px-[0.6rem] py-[0.28rem] text-muted-foreground no-underline hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring data-active:bg-accent data-active:text-accent-foreground",
  },
});

const { root, scroll, section, heading, link } = sideNav();
const { list } = docsNavList();

export function SideNav(): ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className={root()}>
      <ScrollArea.Root className={scroll()}>
        {NAV_GROUPS.map((group) => (
          <div className={section()} key={group.label}>
            <div className={heading()}>{group.label}</div>
            <ul className={list()}>
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      className={link()}
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
