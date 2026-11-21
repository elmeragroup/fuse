/**
 * Unit under test: the invalid focus ring of the seven sets that draw one, as the kit builds it: the
 * shadows and the stroke of the frame that carries the ring, resolved in the in-memory file the
 * token sync writes under every pin a designer can give a frame (`test/mode-sweep.ts`).
 * Oracle: Chromium's computed `box-shadow` and `border-top-color` of the element the recipe rings,
 * on the same cell rendered as `figma:capture` renders it, under the theme each pin stamps.
 * `figma:capture --check` reads one theme, and the frozen keys and the inventory counts read no
 * shadow, so this test goes red where the build drops the ring, binds the wrong tint or puts the
 * ring on another frame.
 *
 * Each set names the frame and the element by hand. Six sets ring their root. Number field rings
 * Base UI's group around the input, which carries no `data-slot`, so the element goes by its place.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import {
  colorIn,
  computedColor,
  named,
  pixelsIn,
  rgba,
  sameColor,
  sweepSet,
  sweptFile,
} from "../../test/mode-sweep.ts";
import type { SweptFile, SweptMode } from "../../test/mode-sweep.ts";
import type { Rgba } from "../variable-set.ts";
import { splitTopLevel } from "./css-values.ts";
import type { BoxSpec } from "./kit-spec.ts";

/** A set that draws the invalid focus ring, the layer path of its ringed frame, and the place of its ringed element. */
type Ring = {
  readonly set: string;
  /** The keys from the variant's root down to the frame, empty for the root. */
  readonly frame: readonly string[];
  /** The element's place, as `ComputedElement` names it. */
  readonly element: string;
};

const RINGS: readonly Ring[] = [
  { set: "checkbox", frame: [], element: "checkbox" },
  { set: "switch", frame: [], element: "switch" },
  { set: "input", frame: [], element: "input" },
  { set: "textarea", frame: [], element: "textarea" },
  { set: "number-field", frame: ["number-field", "group"], element: "field/1/0" },
  { set: "radio", frame: [], element: "radio-group-item" },
  { set: "radio-icon-button", frame: [], element: "radio-icon-button" },
];

/**
 * How far apart a built color's channel and Chromium's may sit, in `0..1`: Chromium serializes the
 * `error/20` ring in `oklab()` at a few digits, which converts back to sRGB within a thousandth.
 * The tints a ring could swap differ by far more, such as `error/20` and `error/30` in alpha.
 */
const RING_COLOR_TOLERANCE = 0.004;

/** How far apart, in CSS pixels, a built shadow length and Chromium's may sit. */
const LENGTH_TOLERANCE_PX = 0.01;

/** A drop shadow in CSS pixels, with its color as sRGB. */
type Shadow = {
  readonly color: Rgba;
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
};

/**
 * A computed `box-shadow` as Chromium serializes it, each layer's color first, in the order Figma
 * paints them: CSS paints its first layer on top, and Figma each shadow above the ones before it.
 * Tailwind's unused layers, transparent and zero in every length, paint nothing and drop out.
 */
function computedShadows(value: string | undefined): readonly Shadow[] {
  if (value === undefined || value === "none") {
    return [];
  }
  return splitTopLevel(value, ",")
    .map((layer) => {
      const [color, ...lengths] = splitTopLevel(layer, " ");
      const [x = 0, y = 0, blur = 0, spread = 0] = lengths.map((length) => Number.parseFloat(length));
      return { color: computedColor(color), x, y, blur, spread };
    })
    .filter(
      ({ color, x, y, blur, spread }) => color.a > 0 || [x, y, blur, spread].some((length) => length !== 0)
    )
    .toReversed();
}

/** A built frame's shadows under a pin. */
function shadowsIn(file: SweptFile, layer: BoxSpec, mode: SweptMode): readonly Shadow[] {
  return layer.shadows.map((shadow) => ({
    color: colorIn(file.figma, shadow.color, mode),
    x: shadow.offsetX,
    y: shadow.offsetY,
    blur: pixelsIn(file.figma, shadow.radius, mode),
    spread: pixelsIn(file.figma, shadow.spread, mode),
  }));
}

/** A shadow stack as a failure names it. */
const shadowText = (shadows: readonly Shadow[]): string =>
  shadows.length === 0
    ? "none"
    : shadows
        .map(({ color, x, y, blur, spread }) => `${rgba(color)} ${[x, y, blur, spread].join(" ")}`)
        .join(", ");

/** Whether two shadow stacks match, layer by layer, within the tolerances. */
function sameShadows(left: readonly Shadow[], right: readonly Shadow[]): boolean {
  return (
    left.length === right.length &&
    left.every((shadow, at) => {
      const other = right[at];
      return (
        other !== undefined &&
        sameColor(shadow.color, other.color, RING_COLOR_TOLERANCE) &&
        (["x", "y", "blur", "spread"] as const).every(
          (length) => Math.abs(shadow[length] - other[length]) <= LENGTH_TOLERANCE_PX
        )
      );
    })
  );
}

/** The frame at a layer path below a variant's root. */
function frameAt(root: BoxSpec, path: readonly string[]): BoxSpec | undefined {
  return path.reduce<BoxSpec | undefined>((frame, key) => {
    const child = frame?.children.find((each) => each.key === key);
    return child?.kind === "frame" ? child : undefined;
  }, root);
}

let kit: BuiltSets;
let file: SweptFile;

beforeAll(async () => {
  [kit, file] = await Promise.all([builtKit(), sweptFile()]);
});

describe.each(RINGS)("the $set set at invalid focus", ({ set, frame: path, element: place }) => {
  it(`draws the ring and the stroke of ${place} on its ${path.join("/") || "root"} frame under every pin`, async () => {
    const swept = await sweepSet(set, (cell) => cell.state === "invalid-focus", file.modes, [
      "box-shadow",
      "border-top-color",
    ]);
    const apart = swept.flatMap((each) => {
      const at = `${each.key} ${named(each.mode)}`;
      const frame = frameAt(variantRoot(kit.spec, each.key), path);
      const element = each.elements.find((computed) => computed.place === place);
      if (frame === undefined || element === undefined) {
        return [`${at}: no frame ${path.join("/")} in Figma or no ${place} in Chromium`];
      }
      const figma = shadowsIn(file, frame, each.mode);
      const chromium = computedShadows(element.styles["box-shadow"]);
      const stroke =
        frame.stroke === undefined ? undefined : colorIn(file.figma, frame.stroke.color, each.mode);
      const border = computedColor(element.styles["border-top-color"]);
      return [
        ...(sameShadows(figma, chromium)
          ? []
          : [`${at}: shadows ${shadowText(figma)} in Figma, ${shadowText(chromium)} in Chromium`]),
        ...(stroke !== undefined && sameColor(stroke, border, RING_COLOR_TOLERANCE)
          ? []
          : [
              `${at}: stroke ${stroke === undefined ? "none" : rgba(stroke)} in Figma, ${rgba(border)} in Chromium`,
            ]),
      ];
    });
    expect(new Set(swept.map(({ mode }) => mode))).toEqual(new Set(file.modes));
    expect(apart).toEqual([]);
  });
});
