"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

import { COMPONENT_NAV } from "../lib/nav";
import "./SideNav.css";

export function SideNav(): ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="SideNavRoot">
      <ScrollArea.Root className="SideNavScroll">
        <div className="SideNavSection">
          <div className="SideNavHeading">Components</div>
          <ul className="SideNavList">
            {COMPONENT_NAV.map((item) => {
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
      </ScrollArea.Root>
    </nav>
  );
}
