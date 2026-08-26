import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

import type { RscStatus } from "../lib/docs-model";

const docsRscBadge = tv({
  base: "font-docs-mono text-docs-sub border-docs-line rounded-[999px] border px-[0.55em] py-[0.15em] text-[10.5px]",
  variants: {
    variant: {
      intro: "",
      part: "data-[rsc=server]:border-docs-rsc-line data-[rsc=server]:bg-docs-rsc-soft data-[rsc=server]:text-docs-rsc whitespace-nowrap",
    },
  },
  defaultVariants: {
    variant: "intro",
  },
});

export type DocsRscBadgeProps = ComponentProps<"span"> & {
  rsc: RscStatus;
  /** Intro shows the raw status; part headers color server-safe rows. */
  variant?: "intro" | "part";
};

export function DocsRscBadge({
  className,
  rsc,
  variant = "intro",
  ...props
}: DocsRscBadgeProps): ReactElement {
  return (
    <span
      className={docsRscBadge({ variant, className })}
      data-rsc={variant === "part" ? rsc : undefined}
      {...props}
    />
  );
}
