import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

const docsCodeBlock = tv({
  base: "bg-docs-code font-docs-mono overflow-x-auto text-[12px] leading-[1.65] [tab-size:2] text-[var(--sh-identifier,var(--color-docs-ink))] [&_.sh__line]:block [&_.sh__line]:min-h-[1lh] [&_code]:block [&_code]:min-w-max [&_code]:border-0 [&_code]:p-0 [&_code]:[background:none] [&_code]:[font:inherit]",
  variants: {
    variant: {
      standalone: "border-docs-line my-[1.1rem] rounded-[8px] border p-[0.9rem_1rem]",
      embedded: "border-docs-line m-0 border-t p-[1rem_1.1rem]",
    },
  },
  defaultVariants: {
    variant: "standalone",
  },
});

export type DocsCodeBlockProps = ComponentProps<"pre"> & {
  variant?: "standalone" | "embedded";
};

/** Highlighted source: MDX fences (`standalone`) and demo-frame source (`embedded`). */
export function DocsCodeBlock({
  className,
  variant = "standalone",
  ...props
}: DocsCodeBlockProps): ReactElement {
  return <pre className={docsCodeBlock({ variant, className })} {...props} />;
}
