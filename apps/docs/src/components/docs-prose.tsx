import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsProse = tv({
  base: "prose prose-sm prose-docs prose-code:font-docs-mono prose-pre:font-docs-mono prose-headings:scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] max-w-none",
  variants: {
    context: {
      page: "",
      component: "mt-[1.4rem]",
    },
  },
  defaultVariants: {
    context: "page",
  },
});

export type DocsProseProps = ComponentProps<"div"> & {
  /** Component pages need a little space under the intro; handbook pages do not. */
  context?: "page" | "component";
};

/**
 * Authored markdown/TSX copy. Typography `prose-sm` owns spacing and type scale;
 * `prose-docs` maps colors and the docs mono font.
 */
export function DocsProse({ className, context = "page", ...props }: DocsProseProps): ReactElement {
  return <div className={docsProse({ context, className })} {...props} />;
}
