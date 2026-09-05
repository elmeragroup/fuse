import type { ComponentPropsWithoutRef } from "react";

export type BespokeSvgProps = ComponentPropsWithoutRef<"svg"> & {
  title?: string;
};

export type LogoProps = BespokeSvgProps & {
  variant?: "full" | "mark";
};

/**
 * Accessible name is only the optional `title` prop (role=img + a prop-driven
 * `<title>`). Decorative otherwise. Never ship a static `<title>`.
 * Fixed-palette artwork is permitted for illustrations (multi-color hex or
 * theme fill classes). Bespoke assets are server-safe: no hooks, no
 * "use client". Referenced clip-path / mask / gradient ids are namespaced
 * statically per asset (e.g. `signing-clip`); two instances of the SAME asset
 * share identical defs by construction, so first-in-DOM wins harmlessly —
 * the namespace exists to prevent CROSS-asset collisions.
 */
export function decorativeSvgProps(title: string | undefined) {
  if (title !== undefined) {
    return { role: "img" as const };
  }
  return { "aria-hidden": true as const, focusable: false as const };
}
