import type { ComponentPropsWithoutRef } from "react";

export type BespokeSvgProps = ComponentPropsWithoutRef<"svg"> & {
  title?: string;
};

export type LogoProps = BespokeSvgProps & {
  variant?: "full" | "mark";
};

/**
 * The naming props of a bespoke SVG: `role="img"` for a nonempty `title`, which the asset renders
 * as a prop-driven `<title>`, or `aria-hidden` and `focusable="false"` for an omitted or empty
 * `title`, which makes the asset decorative. A nonempty `title` prop is the only accessible name.
 * Never ship a static `<title>`.
 *
 * Illustrations may use fixed-palette artwork, in multi-color hex or theme fill classes. Bespoke
 * assets are server-safe, with no hooks and no "use client". Each asset namespaces the clip-path,
 * mask and gradient ids it references with a static prefix, such as `signing-clip`. Two instances
 * of the same asset share identical defs, so the first in the DOM wins with no visible difference.
 * The namespace prevents collisions between different assets.
 *
 * @param title - The accessible name, or `undefined` for a decorative asset.
 * @returns The ARIA props to spread on the `<svg>`.
 */
export function decorativeSvgProps(title: string | undefined) {
  if (title) {
    return { role: "img" as const };
  }
  return { "aria-hidden": true as const, focusable: false as const };
}
