import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

export const MAIN_CONTENT_ID = "main-content";

const skipNav = tv({
  slots: {
    root: "focus-visible:h-docs-header absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip-path:inset(50%)] [clip:rect(0_0_0_0)] focus-visible:top-0 focus-visible:left-0 focus-visible:z-20 focus-visible:m-0 focus-visible:inline-flex focus-visible:w-auto focus-visible:items-center focus-visible:overflow-visible focus-visible:bg-background focus-visible:px-3 focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:[clip-path:none] focus-visible:[clip:auto]",
  },
});

const { root } = skipNav();

export function SkipNav(): ReactElement {
  return (
    <a className={root()} href={"#" + MAIN_CONTENT_ID}>
      Skip to contents
    </a>
  );
}
