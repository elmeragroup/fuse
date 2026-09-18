import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsLede = tv({
  base: "text-base leading-relaxed m-0 max-w-[56ch] text-foreground",
});

export type DocsLedeProps = ComponentProps<"p">;

/** One-paragraph description under the page title. */
export function DocsLede({ className, ...props }: DocsLedeProps): ReactElement {
  return <p className={docsLede({ className })} {...props} />;
}
