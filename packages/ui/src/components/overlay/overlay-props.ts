import type { RefObject } from "react";

/**
 * The portal-target prop every overlay carries (theming.md §7.4). Declared once so the
 * default — the nearest enclosing `ThemeScope` element — is documented in one place and
 * cannot drift between the twelve overlays that resolve it through
 * `useResolvedPortalContainer`.
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
 * internal Positioner. The documented defaults are the family defaults (Popover's);
 * an overlay whose default differs — Tooltip's `side`, DropdownMenu's `align` — omits
 * that key and redeclares it with its own doc comment.
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
