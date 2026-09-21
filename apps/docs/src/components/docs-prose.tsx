import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsProse = tv({
  base: "prose prose-sm prose-docs prose-headings:scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] max-w-none",
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
 * `prose-docs` maps typography roles to the library's colors and fonts.
 */
export function DocsProse({ className, context = "page", ...props }: DocsProseProps): ReactElement {
  return <div className={docsProse({ context, className })} {...props} />;
}
