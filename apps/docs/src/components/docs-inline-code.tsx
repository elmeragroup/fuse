import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsInlineCode = tv({
  base: "text-xs rounded-md border border-border bg-muted px-[0.35em] py-[0.1em] font-mono before:content-none after:content-none",
});

export type DocsInlineCodeProps = ComponentProps<"code">;

/** Owned inline `<code>` pill for generated spans and MDX inline code. */
export function DocsInlineCode({ className, ...props }: DocsInlineCodeProps): ReactElement {
  return <code className={docsInlineCode({ className })} {...props} />;
}
