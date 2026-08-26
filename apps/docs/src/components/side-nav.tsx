"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

import { NAV_GROUPS } from "../lib/nav";
import "./side-nav.css";

export function SideNav(): ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="SideNavRoot">
      <ScrollArea.Root className="SideNavScroll">
        {NAV_GROUPS.map((group) => (
          <div className="SideNavSection" key={group.label}>
            <div className="SideNavHeading">{group.label}</div>
            <ul className="SideNavList">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      className="SideNavLink"
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
