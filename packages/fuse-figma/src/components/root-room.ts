/**
 * The room a variant root has: the width its preview's container gives a block-level root, less its
 * margins, the height its containing block gives its percentages, and the viewport a fixed root's
 * percentages and insets take. It also holds the displays that make a box block-level.
 * `component-builder.ts` reads a root's room here, `fixed-placement.ts` a fixed root's, and
 * `box-flow.ts` the block-level displays.
 */

import { literalPixels, marginsAcross } from "./box-insets";
import { HUG, NO_BASIS, outOfFlow } from "./box-room";
import type { AxisRoom, Room } from "./box-room";
import type { PreviewLength } from "./component-spec";
import { evaluateLength, normalizeCss } from "./css-values";
import type { VariableIndex, Viewport } from "./css-values";
import type { LayerStyle } from "./layer-style";
import type { PercentBasis } from "./sizing-value";
import { NO_CAP } from "./width-cap";

/**
 * The displays that make a box block-level (CSS Display 3 §2.1), whose unset width fills its
 * container (CSS 2.1 §10.3.3) and which a block box stacks down its content box, a list item's and a
 * flow root's included, and a table caption's, a block box in its table's wrapper box, as wide as the
 * table (CSS 2.1 §17.4).
 */
export const BLOCK_LEVEL: ReadonlySet<string> = new Set([
  "block",
  "list-item",
  "flex",
  "grid",
  "flow-root",
  "table-caption",
]);

/**
 * The room a variant root has. Its component set has no auto layout, so it fills nothing and an
 * unset length hugs, except where the definition names the width the root's container gives it: a
 * block-level root, such as a `flex` column, then takes that width, as a block box with no width
 * fills its container less its margins across (CSS 2.1 §10.3.3), where each is the same length in
 * every mode, as a menu separator's `-mx-(--surface-pad-sm)` widens it by 4px on each side at both
 * densities. With no preview width, an in-flow block-level root with no margins, padding or border
 * across takes `100%` as its unset width, which hugs. An in-flow root with no preview width lays out
 * in unbounded room, as {@link Room.unbounded} says, since nothing in its component set gives it a
 * width.
 *
 * @param preview - The width the root's container gives it, which its percentage width takes, and
 *   the height its containing block gives it, which its percentage height takes, each undefined
 *   where the definition names none, and the host's height where the flex rows around a root of
 *   `auto` height stretch it there, which its unset height takes, as `stretchedToHost` in
 *   `percent-height.ts` reads it.
 * @param style - The root's style, whose `display` says whether the root is block-level and whose
 *   `position` whether it sits in its container's flow.
 * @param variables - The synced variables a margin can read, with the values they hold in each mode.
 * @param viewport - The viewport the definition declares, which a fixed root's percentages, `dvh`
 *   and `dvw` take, and whose size its opposing zero insets give it, or undefined for none.
 * @returns The root's room.
 */
export function rootRoom(
  preview: {
    readonly width: number | undefined;
    readonly height: PreviewLength | undefined;
    readonly stretched?: number | undefined;
  },
  style: LayerStyle,
  variables: VariableIndex,
  viewport: Viewport | undefined
): Room {
  if (viewport !== undefined && normalizeCss(style.raw("position") ?? "") === "fixed") {
    return viewportRoom(style, viewport);
  }
  const { width: previewWidth, height: previewHeight } = preview;
  const blockLevel = BLOCK_LEVEL.has(normalizeCss(style.raw("display") ?? ""));
  const fills = previewWidth !== undefined && blockLevel;
  const margins = marginsAcross(style, variables) ?? 0;
  const inFlow = !outOfFlow(style);
  const percent = (): PercentBasis => {
    if (previewWidth !== undefined) {
      return { kind: "length", value: previewWidth, of: "the preview" };
    }
    // An absolute root's 100% takes its containing block, while its unset width shrinks to fit.
    return inFlow && blockLevel && noInsetsAcross(style) ? { kind: "unset" } : NO_BASIS;
  };
  return {
    horizontal: {
      percent: percent(),
      auto: fills ? { kind: "fixed", length: { kind: "literal", value: previewWidth - margins } } : HUG,
      siblings: [],
      length: undefined,
    },
    vertical: {
      percent:
        previewHeight === undefined
          ? NO_BASIS
          : { kind: "length", value: previewHeight.pixels, of: "the preview", css: previewHeight.css },
      auto:
        preview.stretched === undefined
          ? HUG
          : { kind: "fixed", length: { kind: "literal", value: preview.stretched } },
      siblings: [],
      length: undefined,
    },
    widthCap: NO_CAP,
    unbounded: inFlow && previewWidth === undefined,
  };
}

/**
 * The room of a fixed root in a declared viewport, its containing block (CSS 2.1 §10.1): its
 * percentages take the viewport's width and height, and its `dvh` and `dvw` the viewport. Where both
 * insets of an axis are literal lengths and the root sets no size there, they size it to the viewport
 * less the insets (CSS 2.1 §10.3.7, §10.6.4), as a scrim's `inset-0` fills the window; otherwise the
 * root shrinks to fit, as an absolute box does.
 *
 * @param style - The fixed root's style.
 * @param viewport - The viewport its definition declares.
 * @returns The root's room.
 */
export function viewportRoom(style: LayerStyle, viewport: Viewport): Room {
  const axis = (length: number, size: string, insets: readonly [string, string]): AxisRoom => {
    const offsets = insets.map((property) => evaluateLength(style.resolved(property) ?? ""));
    const automatic = normalizeCss(style.resolved(size) ?? "auto") === "auto";
    const [start, end] = offsets;
    return {
      percent: { kind: "length", value: length, of: "the viewport", viewport },
      auto:
        automatic && start !== undefined && end !== undefined
          ? { kind: "fixed", length: { kind: "literal", value: length - start - end } }
          : HUG,
      siblings: [],
      length: undefined,
    };
  };
  return {
    horizontal: axis(viewport.width, "width", ["left", "right"]),
    vertical: axis(viewport.height, "height", ["top", "bottom"]),
    widthCap: NO_CAP,
    unbounded: false,
  };
}

/**
 * Whether a box sets no margin, padding or border across: each margin zero or `auto`, which beside
 * a `100%` width resolves to zero (CSS 2.1 §10.3.3), and each padding and the border zero.
 */
function noInsetsAcross(style: LayerStyle): boolean {
  const margins = ["margin-left", "margin-right"].every((property) => {
    const value = style.resolved(property);
    return value === undefined || normalizeCss(value) === "auto" || evaluateLength(value) === 0;
  });
  return (
    margins &&
    ["padding-left", "padding-right", "border-width", "border-left-width", "border-right-width"].every(
      (property) => literalPixels(style, property) === 0
    )
  );
}
