import type { RefObject } from "react";

/**
 * The portal-target prop every overlay carries, declared once so its default, the nearest
 * enclosing `ThemeScope` element, is documented in one place.
 *
 * The prop's sentence names no kind of overlay. A consumer may portal a popup, a modal, a side
 * panel or a toast viewport, and the docs generator publishes this text into every public prop
 * table that intersects this type.
 */
export type OverlayContainerProps = {
  /**
   * The element the overlay renders into. Unset, it is the nearest enclosing `ThemeScope`
   * element, so the overlay keeps the theme of the place that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

/**
 * The four positioner props an overlay lifts onto its Content part and forwards to the
 * internal Positioner. It holds descriptions only; each component's destructuring sets the
 * published defaults. The generic is a structural bound on the four keys, because Base UI
 * does not export its `Side`, `Align` and `OffsetFunction` types from a public subpath. Each
 * overlay pins the exact types by passing its own positioner's props.
 */
export type OverlayPositionerProps<
  Positioner extends {
    align?: unknown;
    alignOffset?: unknown;
    side?: unknown;
    sideOffset?: unknown;
  },
> = {
  /** How the popup lines up with the trigger along the side it opens on. */
  align?: Positioner["align"];
  /** The popup's shift along the side it opens on, in pixels. */
  alignOffset?: Positioner["alignOffset"];
  /** The side of the trigger the popup opens on. */
  side?: Positioner["side"];
  /** The gap between the trigger and the popup, in pixels. */
  sideOffset?: Positioner["sideOffset"];
};
