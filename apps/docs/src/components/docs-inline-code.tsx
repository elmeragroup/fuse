import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsInlineCode = tv({
  base: "text-xs docs-chip rounded-md border border-border bg-muted before:content-none after:content-none",
});

export type DocsInlineCodeProps = ComponentProps<"code">;

/** Owned inline `<code>` pill for generated spans and MDX inline code. */
export function DocsInlineCode({ className, ...props }: DocsInlineCodeProps): ReactElement {
  return <code className={docsInlineCode({ className })} {...props} />;
}
