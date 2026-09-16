import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsLede = tv({
  base: "text-base m-0 max-w-[56ch] leading-[1.6] text-foreground",
});

export type DocsLedeProps = ComponentProps<"p">;

/** One-paragraph description under the page title. */
export function DocsLede({ className, ...props }: DocsLedeProps): ReactElement {
  return <p className={docsLede({ className })} {...props} />;
}
