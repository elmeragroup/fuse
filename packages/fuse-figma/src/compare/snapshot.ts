/**
 * The snapshot the components plugin exports for `figma:compare`: one PNG per instance in the
 * kit's preview frames, with the geometry and the variable modes the comparison needs to render
 * the same cell in a browser. Every type is plain data that survives the JSON round trip, and
 * the plugin bundles only this module's constants.
 *
 * Geometry is in Figma canvas pixels, the unit of `absoluteBoundingBox`, which equals a CSS
 * pixel at 100% zoom. Both rectangles are absolute positions on the page, as Figma reports them,
 * so a reader works out the PNG's place from `renderBounds - box`.
 */

import type { ModeRef } from "../components/kit-spec.ts";

/** The `format` every snapshot carries, so `figma:compare` can refuse another JSON file. */
export const SNAPSHOT_FORMAT = "fuse-kit-snapshots";

/** The snapshot layout version. A change that breaks readers bumps it. */
export const SNAPSHOT_VERSION = 1;

/** A rectangle on the Figma page, in canvas pixels. */
export type CanvasRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** What Figma drew for an instance. */
export type InstanceImage = {
  /**
   * `absoluteRenderBounds`: the box plus anything drawn outside it, such as a focus ring. The PNG
   * covers exactly this rectangle, at the snapshot's scale.
   */
  readonly renderBounds: CanvasRect;
  /** The PNG `exportAsync` returned, base64-encoded, in sRGB. */
  readonly png: string;
};

/** One instance of a preview frame. */
export type InstanceSnapshot = {
  /** The instance's own key, `${previewKey}/${variantKey}`. */
  readonly key: string;
  /**
   * The variant the instance shows: the key of its main component, such as
   * `button/variant=default,size=sm,state=rest,icon=none`.
   */
  readonly variant: string;
  /** `absoluteBoundingBox`: the instance's frame, without strokes or effects. */
  readonly box: CanvasRect;
  /** The export, or null when Figma draws nothing for the instance, such as a hidden one. */
  readonly image: InstanceImage | null;
};

/** One preview frame and the modes it renders its instances in. */
export type PreviewSnapshot = {
  /** The frame's key, such as `preview/button/internal-fkas-private-light`. */
  readonly key: string;
  /** The frame's layer name. */
  readonly name: string;
  /** The mode the frame resolves for every variable collection, by collection and mode name. */
  readonly modes: readonly ModeRef[];
  /** The kit's instances in the frame, in layer order. */
  readonly instances: readonly InstanceSnapshot[];
};

/** Everything one export wrote. */
export type KitSnapshot = {
  readonly format: typeof SNAPSHOT_FORMAT;
  readonly version: typeof SNAPSHOT_VERSION;
  /** When the plugin exported, as an ISO 8601 timestamp. */
  readonly exportedAt: string;
  /** The Figma file's name. */
  readonly file: string;
  /** Device pixels per canvas pixel in every PNG. */
  readonly scale: number;
  readonly previews: readonly PreviewSnapshot[];
};
