import type { RefObject } from "react";

/**
 * The portal-target prop every overlay carries (theming.md §7.4). Declared once so the
 * default — the nearest enclosing `ThemeScope` element — is documented in one place.
 * Popover is the first consumer; the remaining eleven overlays still spell the prop
 * locally and adopt this type as they are migrated.
 */
export type OverlayContainerProps = {
  /**
   * Portal target for the popup. Defaults to the nearest enclosing `ThemeScope`
   * element, so an overlay never escapes the theme that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

/**
 * The anchor-positioning surface shared by every base-ui positioner (Popover, Tooltip,
 * Menu, Select, Combobox). Spelled structurally because base-ui does not publish its
 * `Side`/`Align`/`OffsetFunction` types through an exported subpath; each overlay pins
 * the exact types by passing its own positioner's props to
 * {@link OverlayPositionerProps}.
 */
export type OverlayAnchorPositioning = {
  align?: "start" | "center" | "end";
  alignOffset?: number | ((data: never) => number);
  side?: "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start";
  sideOffset?: number | ((data: never) => number);
};

/**
 * The four positioner props an overlay lifts onto its Content part and forwards to the
 * internal Positioner.
 *
 * **The `@default` tags below are Popover's, and nothing verifies them for a consumer.**
 * The docs generator publishes these tags verbatim into the public prop table, so an
 * overlay whose runtime default differs must `Omit` that key and redeclare it with a
 * doc comment naming its own default — Tooltip destructures `side = "top"`
 * (`tooltip.tsx`), DropdownMenu destructures `align = "start"`
 * (`dropdown-menu.tsx`), and both would publish a wrong table if they inherited these.
 * When redeclaring, copy the destructured default into the `@default` tag by hand and
 * re-read it whenever the destructuring changes; there is no gate on the pair.
 */
export type OverlayPositionerProps<Positioner extends OverlayAnchorPositioning> = {
  /**
   * How the popup aligns to the trigger on the cross axis.
   * @default "center"
   */
  align?: Positioner["align"];
  /**
   * Offset along the alignment axis, in pixels.
   * @default 0
   */
  alignOffset?: Positioner["alignOffset"];
  /**
   * Which side of the trigger the popup is placed on.
   * @default "bottom"
   */
  side?: Positioner["side"];
  /**
   * Distance from the trigger, in pixels.
   * @default 4
   */
  sideOffset?: Positioner["sideOffset"];
};
