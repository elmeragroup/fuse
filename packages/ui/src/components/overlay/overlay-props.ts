import type { RefObject } from "react";

/**
 * The portal-target prop every overlay carries (theming.md §7.4). Declared once so the
 * default — the nearest enclosing `ThemeScope` element — is documented in one place.
 *
 * The prop's own sentence is deliberately overlay-neutral: a consumer may portal a
 * popup, a modal, a side panel or a toast viewport, and the docs generator publishes
 * this text verbatim into every public prop table that intersects this type.
 */
export type OverlayContainerProps = {
  /**
   * Portal target for this overlay. Defaults to the nearest enclosing `ThemeScope`
   * element, so it never escapes the theme that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

/**
 * The four positioner props an overlay lifts onto its Content part and forwards to the
 * internal Positioner. Descriptions only — published defaults come from each
 * component's destructuring. The generic is a structural bound on the four keys because
 * base-ui does not publish its `Side`/`Align`/`OffsetFunction` types through an
 * exported subpath; each overlay pins the exact types by passing its own
 * positioner's props.
 */
export type OverlayPositionerProps<
  Positioner extends {
    align?: unknown;
    alignOffset?: unknown;
    side?: unknown;
    sideOffset?: unknown;
  },
> = {
  /**
   * How the popup aligns to the trigger on the cross axis.
   */
  align?: Positioner["align"];
  /**
   * Offset along the alignment axis, in pixels.
   */
  alignOffset?: Positioner["alignOffset"];
  /**
   * Which side of the trigger the popup is placed on.
   */
  side?: Positioner["side"];
  /**
   * Distance from the trigger, in pixels.
   */
  sideOffset?: Positioner["sideOffset"];
};
