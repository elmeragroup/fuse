import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsInlineCode = tv({
  // The em padding scales with the chip's own text; `oxlint.config.ts` allows these two
  // off-scale values for this file (no scale neighbour) instead of declaring a CSS utility.
  // Each class sits behind `not-in-data-[prose=page]:`, so inline code in a handbook page's prose
  // keeps the typography's own code style, as the page's TSX `<code>` did before it became MDX.
  base: "not-in-data-[prose=page]:text-xs not-in-data-[prose=page]:rounded-md not-in-data-[prose=page]:border not-in-data-[prose=page]:border-border not-in-data-[prose=page]:bg-muted not-in-data-[prose=page]:px-[0.35em] not-in-data-[prose=page]:py-[0.1em] not-in-data-[prose=page]:before:content-none not-in-data-[prose=page]:after:content-none",
});

type DocsInlineCodeProps = ComponentProps<"code">;

/** Owned inline `<code>` pill for generated spans and MDX inline code outside a handbook page's prose. */
export function DocsInlineCode({ className, ...props }: DocsInlineCodeProps): ReactElement {
  return <code className={docsInlineCode({ className })} {...props} />;
}
