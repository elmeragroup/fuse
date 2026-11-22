/**
 * The CSS properties that size each axis of a box, and the words its coverage rows use for them.
 * `box-sizing.ts`, `box-length.ts`, `box-limits.ts` and `growing-part.ts` read an axis through them.
 */

/** The properties that size one axis, and the words its coverage rows use. */
export type AxisProperties = {
  readonly length: "width" | "height";
  readonly min: "min-width" | "min-height";
  readonly max: "max-width" | "max-height";
  /** What a minimum does to the box when it raises the length. */
  readonly grows: string;
  /** What a maximum does to the box when it lowers the length. */
  readonly shrinks: string;
  /** The flex box that lays its layers out along the axis. */
  readonly flow: "row" | "column";
};

/** The properties that size a box's width. */
export const WIDTH: AxisProperties = {
  length: "width",
  min: "min-width",
  max: "max-width",
  grows: "widens",
  shrinks: "narrows",
  flow: "row",
};

/** The properties that size a box's height. */
export const HEIGHT: AxisProperties = {
  length: "height",
  min: "min-height",
  max: "max-height",
  grows: "lengthens",
  shrinks: "shortens",
  flow: "column",
};
