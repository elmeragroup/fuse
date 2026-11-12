import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

/**
 * The section title of a component page. `everywhere` is the generated sections' (demo, API,
 * tokens). `outsideProse` is the same list for an authored `##` heading, such as `## Usage`, each
 * class behind `not-in-[.prose]:` so the typography styles keep a heading inside `<Prose>`. The
 * two lists stay literal, since Tailwind finds classes by reading the source, and change together.
 */
const docsSectionHeading = tv({
  variants: {
    scope: {
      everywhere:
        "text-lg font-semibold mt-12 mb-[0.9rem] scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] border-t border-border pt-6 font-heading",
      outsideProse:
        "not-in-[.prose]:text-lg not-in-[.prose]:font-semibold not-in-[.prose]:mt-12 not-in-[.prose]:mb-[0.9rem] not-in-[.prose]:scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] not-in-[.prose]:border-t not-in-[.prose]:border-border not-in-[.prose]:pt-6 not-in-[.prose]:font-heading",
    },
  },
  defaultVariants: { scope: "everywhere" },
});

type DocsSectionHeadingProps = ComponentProps<"h2"> & {
  /**
   * `everywhere` for a generated section (demo, API, tokens); `outsideProse` for an authored `##`
   * heading, which keeps the typography styles inside `<Prose>`.
   */
  scope?: "everywhere" | "outsideProse";
};

/** A component page's section title, generated or authored. */
export function DocsSectionHeading({
  scope = "everywhere",
  className,
  ...props
}: DocsSectionHeadingProps): ReactElement {
  return <h2 className={docsSectionHeading({ scope, className })} {...props} />;
}
