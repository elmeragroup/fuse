import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsPageTitle = tv({
  base: "m-0 mb-[0.6rem] text-[2rem] font-[650] tracking-[-0.02em]",
});

export type DocsPageTitleProps = ComponentProps<"h1">;

/** The page H1. Title styles live here so the shell does not restyle every heading. */
export function DocsPageTitle({ className, ...props }: DocsPageTitleProps): ReactElement {
  return <h1 className={docsPageTitle({ className })} {...props} />;
}
