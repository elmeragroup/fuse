import type { ComponentProps, ReactElement } from "react";

import { tv } from "tailwind-variants";

import type { RscStatus } from "../lib/docs-model";

const docsRscBadge = tv({
  base: "text-xs rounded-full border border-border px-[0.55em] py-[0.15em] font-mono text-muted-foreground",
  variants: {
    variant: {
      intro: "",
      part: "whitespace-nowrap data-[rsc=server]:border-success/30 data-[rsc=server]:bg-success-soft data-[rsc=server]:text-success-soft-foreground",
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
