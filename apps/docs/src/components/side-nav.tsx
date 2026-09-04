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
    root: "border-docs-line min-[45rem]:top-docs-header border-r px-4 pt-6 pb-16 text-[0.82rem] min-[45rem]:sticky min-[45rem]:h-[calc(100vh_-_var(--spacing-docs-header))] min-[45rem]:overflow-hidden",
    scroll: "h-auto max-h-48 min-[45rem]:h-full min-[45rem]:max-h-none",
    section: "mb-[1.4rem]",
    heading: "text-docs-sub mb-[0.4rem] block pl-[0.6rem] text-[0.82rem] font-[450]",
    link: "text-docs-sub hover:bg-docs-soft hover:text-docs-ink data-active:bg-docs-soft data-active:text-docs-ink focus-visible:outline-docs-ink block rounded-[6px] px-[0.6rem] py-[0.28rem] no-underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] data-active:font-[550]",
  },
});

export function SideNav(): ReactElement {
  const pathname = usePathname();
  const { root, scroll, section, heading, link } = sideNav();
  const { list } = docsNavList();

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
