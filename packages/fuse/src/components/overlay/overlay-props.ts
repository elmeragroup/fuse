import type { RefObject } from "react";

/**
 * Props for the portal target every overlay carries. The type declares the prop once, so its
 * default, the nearest enclosing `ThemeScope` element, is documented in one place.
 *
 * The prop's sentence names no kind of overlay. A consumer may portal a popup, a modal, a side
 * panel or a toast viewport, and the docs generator publishes this text into every public prop
 * table that intersects this type.
 */
export type OverlayContainerProps = {
  /**
   * The element the overlay renders into. Defaults to the nearest enclosing `ThemeScope` element,
   * so the overlay keeps the theme of the place that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

/**
 * Props for the scrim's blur on `Dialog.Content`, `Dialog.Overlay`, `Sheet.Content`, `Sheet.Overlay`
 * and `AlertDialog.Content`, which takes it through `Dialog.Content`. This module declares the prop
 * once, so every prop table that intersects it shows the same sentence.
 */
export type BackdropBlurProps = {
  /**
   * Whether the scrim blurs the page behind it. Set it to `false` for an overlay portaled into a
   * transformed scope, such as a zoomable canvas or an artboard, where the blur samples shifted
   * content and the blurred copy no longer lines up with the page. The scrim keeps its tint either
   * way.
   * @default true
   */
  backdropBlur?: boolean;
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
