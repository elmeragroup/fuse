import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

export const MAIN_CONTENT_ID = "main-content";

const skipNav = tv({
  slots: {
    root: "focus-visible:h-docs-header focus-visible:bg-white focus-visible:text-docs-ink focus-visible:outline-docs-ink absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip-path:inset(50%)] [clip:rect(0_0_0_0)] focus-visible:top-0 focus-visible:left-0 focus-visible:z-20 focus-visible:m-0 focus-visible:inline-flex focus-visible:w-auto focus-visible:items-center focus-visible:overflow-visible focus-visible:px-[12px] focus-visible:underline focus-visible:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:[clip-path:none] focus-visible:[clip:auto]",
  },
});

export function SkipNav(): ReactElement {
  const { root } = skipNav();

  return (
    <a className={root()} href={"#" + MAIN_CONTENT_ID}>
      Skip to contents
    </a>
  );
}
