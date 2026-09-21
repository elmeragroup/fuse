import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsInlineCode = tv({
  // The em padding scales with the chip's own text; `.oxlintrc.json` allows these two
  // off-scale values for this file (no scale neighbour) instead of declaring a CSS utility.
  base: "text-xs rounded-md border border-border bg-muted px-[0.35em] py-[0.1em] before:content-none after:content-none",
});

export type DocsInlineCodeProps = ComponentProps<"code">;

/** Owned inline `<code>` pill for generated spans and MDX inline code. */
export function DocsInlineCode({ className, ...props }: DocsInlineCodeProps): ReactElement {
  return <code className={docsInlineCode({ className })} {...props} />;
}
