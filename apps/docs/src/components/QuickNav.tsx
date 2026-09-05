"use client";

import type { ReactElement } from "react";

import { usePathname } from "next/navigation";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

import { tocForPath } from "../lib/nav";
import "./QuickNav.css";

export function QuickNav(): ReactElement {
  const pathname = usePathname();
  const items = tocForPath(pathname);

  return (
    <nav aria-label="On this page" className="QuickNavRoot">
      <ScrollArea.Root className="QuickNavScroll">
        {items.length === 0 ? null : (
          <>
            <p className="QuickNavTitle">On this page</p>
            <ul className="QuickNavList">
              {items.map((item) => (
                <li key={item.id}>
                  <a className="QuickNavLink" href={`#${item.id}`}>
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
