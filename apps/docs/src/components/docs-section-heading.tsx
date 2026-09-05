import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsSectionHeading = tv({
  base: "border-docs-line mt-12 mb-[0.9rem] scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] border-t pt-6 text-[1.15rem] font-[650] tracking-[-0.01em]",
});

export type DocsSectionHeadingProps = ComponentProps<"h2">;

/** Generated component-page section title (demo, API, tokens). */
export function DocsSectionHeading({ className, ...props }: DocsSectionHeadingProps): ReactElement {
  return <h2 className={docsSectionHeading({ className })} {...props} />;
}
