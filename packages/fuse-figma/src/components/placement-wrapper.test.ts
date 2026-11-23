/**
 * Unit under test: `planPlacement` for an absolute instance, read by `readPlacement` and drawn by
 * `wrapPlaced`, as `placement.ts` composes them. Oracles: CSS 2.1 §10.3.7 and §10.6.4, under which a
 * box keeps its declared `right` offset from its containing block's padding edge whatever its own
 * width; probes PG14 and PG14b, under which an instance at MAX in an instance of the outer component
 * keeps its `x` as a mode changes its width, so its right inset drifts; and probe PG16, under which an
 * absolute auto layout row STRETCH across the parent, aligned to its end, padded by the right and top
 * offsets and hugging its height, keeps both offsets of the instance in its flow. The expected
 * wrapper is written from PG16's frame: x 0 at the parent's width, padding right 16 and top 16. PG16
 * measured no other shape, so an instance a mode resizes at the parent's bottom or on both axes keeps
 * no place.
 */
import * as Effect from "effect/Effect";
import { beforeAll, describe, expect, it } from "vitest";

import { planPlacement, readPlacement } from "./absolute-placement.ts";
import type { PlacementContext } from "./absolute-placement.ts";
import type { BuildContext } from "./component-spec.ts";
import { makeVariableIndex } from "./css-values.ts";
import type { EdgePlacementSpec, InstanceAxisPlacementSpec, InstanceLayerSpec } from "./kit-spec.ts";
import { CellLedger, LayerStyle, inheritance } from "./layer-style.ts";
import type { Layer } from "./layer-style.ts";
import { wrapPlaced } from "./placement-wrapper.ts";
import { compileUtilities } from "./utility-css.ts";

let context: BuildContext;

beforeAll(async () => {
  context = {
    compiled: await Effect.runPromise(compileUtilities([])),
    variables: makeVariableIndex([]),
  };
});

const ORIGIN = { record: () => undefined };

/** A box with the declarations, below the parent where there is one. */
function box(cell: CellLedger, declarations: Readonly<Record<string, string>>, parent?: Layer) {
  const layer = cell.add(
    parent === undefined ? new Map() : inheritance(parent, context),
    [
      {
        part: "box",
        className: "sample",
        origin: ORIGIN,
        rank: 0,
        at: undefined,
        order: 0,
        declarations: Object.entries(declarations).map(([property, value]) => ({ property, value })),
      },
    ],
    parent
  );
  return { layer, style: new LayerStyle(cell, layer, []) };
}

/** The close instance as its parent holds it before it is placed: 24px, bound to nothing here. */
const CLOSE: InstanceLayerSpec = {
  kind: "instance",
  key: "close",
  name: "button",
  componentSet: "icon-button",
  variant: "icon-button/size=icon-sm",
  sizing: {
    horizontal: { kind: "fixed", length: { kind: "literal", value: 24 } },
    vertical: { kind: "fixed", length: { kind: "literal", value: 24 } },
  },
  visibleProperty: "Close button",
};

/**
 * Place an absolute instance with `offsets` in a `relative` 448px-wide parent, its padding box known
 * across and unknown down unless given, with the axes the capture measured one length on.
 */
function place(
  offsets: Readonly<Record<string, string>>,
  oneLength: ReadonlySet<"horizontal" | "vertical">,
  paddingBox: PlacementContext["paddingBox"] = { horizontal: 448, vertical: undefined }
) {
  const cell = new CellLedger({
    context,
    origin: ORIGIN,
    record: () => undefined,
    cell: {},
    inPlace: undefined,
  });
  const parent = box(cell, { position: "relative", width: "448px" });
  const part = box(cell, { position: "absolute", ...offsets }, parent.layer);
  const plan = planPlacement(part.style, "instance", {
    parent: parent.style,
    positionedBy: undefined,
    parentSpansBlock: false,
    oneLength,
    flow: [],
    layers: 0,
    paddingBox,
  });
  if (plan === undefined) {
    throw new Error("the part is not absolute");
  }
  const read = readPlacement(part.style, plan);
  if (read.kind === "refused") {
    return read;
  }
  // SAFETY: an instance's plan holds only start, end and centre places.
  const placement = read.placement as EdgePlacementSpec<InstanceAxisPlacementSpec>;
  return read.wrapped === undefined
    ? { kind: "placed" as const, layer: { ...CLOSE, placement } }
    : { kind: "wrapped" as const, layer: wrapPlaced(CLOSE, placement, read.wrapped).layer };
}

describe("an absolute instance at its parent's end", () => {
  it("sits in a wrapper that stretches across the parent and pads its offsets, where a mode can change its width", () => {
    const placed = place({ top: "16px", right: "16px" }, new Set());
    expect(placed).toEqual({
      kind: "wrapped",
      layer: {
        kind: "frame",
        key: "close placement",
        name: "close placement",
        placement: {
          kind: "edges",
          within: "parent",
          horizontal: { kind: "stretch", start: 0, end: 0 },
          vertical: { kind: "start", start: 0 },
        },
        direction: "HORIZONTAL",
        sizing: {
          horizontal: { kind: "fixed", length: { kind: "literal", value: 448 } },
          vertical: { kind: "hug" },
        },
        limits: { minWidth: undefined, maxWidth: undefined, minHeight: undefined, maxHeight: undefined },
        clips: false,
        paddingTop: { kind: "literal", value: 16 },
        paddingRight: { kind: "literal", value: 16 },
        paddingBottom: { kind: "literal", value: 0 },
        paddingLeft: { kind: "literal", value: 0 },
        itemSpacing: { kind: "literal", value: 0 },
        primaryAlign: "MAX",
        counterAlign: "MIN",
        cornerRadius: { kind: "literal", value: 0 },
        fill: undefined,
        stroke: undefined,
        shadows: [],
        opacity: 1,
        children: [CLOSE],
      },
    });
  });

  it("keeps its own MAX place where the capture measured it one width in every mode", () => {
    expect(place({ top: "16px", right: "16px" }, new Set(["horizontal"]))).toEqual({
      kind: "placed",
      layer: {
        ...CLOSE,
        placement: {
          kind: "edges",
          within: "parent",
          horizontal: { kind: "end", end: 16 },
          vertical: { kind: "start", start: 16 },
        },
      },
    });
  });

  it("leaves the wrapper's length to its place where the room does not know the parent's", () => {
    const placed = place({ top: "16px", right: "16px" }, new Set(), {
      horizontal: undefined,
      vertical: undefined,
    });
    expect(placed.kind === "wrapped" ? placed.layer.sizing : placed).toEqual({
      horizontal: { kind: "placed" },
      vertical: { kind: "hug" },
    });
  });

  it.each([
    [
      "a mode can change both of its lengths at the parent's bottom right",
      { bottom: "8px", right: "8px" },
      new Set<"horizontal" | "vertical">(),
    ],
    [
      "a mode can change its width beside a place at the parent's bottom",
      { bottom: "8px", right: "8px" },
      new Set<"horizontal" | "vertical">(["vertical"]),
    ],
    [
      "a mode can change its height at the parent's bottom",
      { bottom: "8px", left: "4px" },
      new Set<"horizontal" | "vertical">(["horizontal"]),
    ],
  ])("leaves its place unmapped where %s, a shape no probe has kept", (_case, offsets, oneLength) => {
    expect(place(offsets, oneLength).kind).toBe("refused");
  });
});
