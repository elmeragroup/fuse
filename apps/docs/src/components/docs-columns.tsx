"use client";

import type { ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { isWidePage } from "../lib/pages";

const docsColumns = tv({
  base: "group/columns mx-auto grid grid-cols-1 min-[45rem]:grid-cols-[240px_minmax(0,1fr)]",
  variants: {
    layout: {
      // The side nav, the page and the On this page column.
      standard: "max-w-[1200px] min-[60rem]:grid-cols-[240px_minmax(0,1fr)_180px]",
      // The side nav and the page, which takes the room a block's live preview needs.
      wide: "max-w-[1600px]",
    },
  },
});

type DocsColumnsProps = {
  children: ReactNode;
};

/**
 * The shell's columns, laid out for the route on screen. The layout comes from the pathname, not
 * from the page's content: Next keeps visited pages mounted in hidden Activity boundaries, so a
 * marker in a page's markup outlives the page. The main column and QuickNav read the same flag,
 * through `data-layout` and `isWidePage`.
 */
export function DocsColumns({ children }: DocsColumnsProps): ReactElement {
  const layout = isWidePage(usePathname()) ? "wide" : "standard";
  return (
    <div className={docsColumns({ layout })} data-layout={layout}>
      {children}
    </div>
  );
}
