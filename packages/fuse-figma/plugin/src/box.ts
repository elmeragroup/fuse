/**
 * A box: a variant's component root, or a frame layer below it. Each is an auto layout frame
 * along the spec's direction that places its content as the spec's alignment says, sizes each
 * axis as fixed, hugging or filling its parent, and keeps within the spec's limits.
 */

import { ringFill } from "../../src/components/kit-spec.ts";
import type { BoxSpec, LimitsSpec, SideStroke } from "../../src/components/kit-spec.ts";
import {
  cornerField,
  LAYOUT_SIZING,
  near,
  planLayoutSizing,
  planLength,
  planLimit,
  planNumber,
  planPaints,
  planScalar,
  planShadows,
} from "./fields.ts";
import type { Held, NumberField, Run } from "./fields.ts";
import { change, recordsAny } from "./plan.ts";

/** A node that holds a box's layers: a variant component, or a frame layer below it. */
export type LayerParent = ComponentNode | FrameNode;

function paddingField(node: LayerParent, side: "Top" | "Right" | "Bottom" | "Left"): NumberField {
  const name = `padding${side}` as const;
  return {
    name,
    bindings: [name],
    matches: (value) => near(node[name], value),
    write: (value) => {
      node[name] = value;
    },
  };
}

function strokeWeightField(node: LayerParent): NumberField {
  const sides = ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"] as const;
  return {
    name: "strokeWeight",
    bindings: sides,
    matches: (value) => sides.every((side) => near(node[side], value)),
    write: (value) => {
      node.strokeWeight = value;
    },
  };
}

/**
 * Plan a stroke on some sides: its four weights, compared and written as one change. On a node whose
 * weight was never written, a 0 on one side sets every side to 0, and after a `strokeWeight` write
 * each side writes alone (PS2). So the change writes `strokeWeight` first, at the largest side's
 * weight, then every side, and a side that already matched is written again after the spill.
 *
 * @param run - The run.
 * @param node - The box.
 * @param label - The box's label, for change lines.
 * @param sides - Each side's weight.
 */
function planStrokeSides(run: Run, node: LayerParent, label: string, sides: SideStroke["sides"]): void {
  const weights = [
    ["strokeTopWeight", sides.top],
    ["strokeRightWeight", sides.right],
    ["strokeBottomWeight", sides.bottom],
    ["strokeLeftWeight", sides.left],
  ] as const;
  const bound = node.boundVariables;
  if (weights.every(([field, weight]) => bound?.[field] === undefined && near(node[field], weight))) {
    return;
  }
  const described = weights.map(([, weight]) => weight).join(" ");
  change(run.plan, label, `stroke weights → ${described}`, () => {
    for (const [field] of weights) {
      node.setBoundVariable(field, null);
    }
    node.strokeWeight = Math.max(...weights.map(([, weight]) => weight));
    for (const [field, weight] of weights) {
      node[field] = weight;
    }
  });
}

const LIMITS: readonly (keyof LimitsSpec)[] = ["minWidth", "maxWidth", "minHeight", "maxHeight"];

/**
 * Plan a stroke's dash pattern, the empty list for a solid stroke. The pattern sits apart from the
 * stroke's paints, so the color binding the stroke takes keeps it (PD). It matches only with as
 * many lengths, each within what a 32-bit float keeps. It moves no layer, so it lies outside the
 * writes that can resize the box.
 */
function planDashPattern(run: Run, node: LayerParent, label: string, desired: readonly number[]): void {
  const held = node.dashPattern;
  const matches =
    held.length === desired.length &&
    held.every((length, index) => {
      const wanted = desired[index];
      return wanted !== undefined && near(length, wanted);
    });
  if (matches) {
    return;
  }
  const lengths = (pattern: readonly number[]): string =>
    pattern.length === 0 ? "none" : pattern.join(", ");
  change(run.plan, label, `dashPattern → ${lengths(desired)} (holds ${lengths(held)})`, () => {
    node.dashPattern = desired;
  });
}

/**
 * Where the box a plan draws sits. A variant's `root` sits in its component set, which never turns,
 * and gets the fill a spread shadow needs from {@link ringFill}. A `frame` below the root takes the
 * fill its spec holds, where the build already put that fill and clipping for a ring (PR2). Its
 * `parent` is `unknown` when the box that holds it turns in this run, which moves the frame's fill
 * to the other axis and can change its size.
 */
export type BoxPlace = { readonly kind: "root" } | { readonly kind: "frame"; readonly parent: Held };

/**
 * Plan a box against the spec: a variant's root, or a frame layer below it. The box lays out its
 * content along the spec's direction and places it on each axis as the spec's alignment says, as
 * `justify-*` and `items-*` place it. It sizes each axis as the spec says and keeps within the
 * spec's limits. The direction comes first, because a direction change moves a hug to the other
 * axis, and the sizing comes after the lengths, because a resize or a length binding turns a hug
 * or a fill fixed. When the box or its parent turns in this run, the plan writes the box's
 * lengths and sizing whatever the box reads now.
 *
 * @param run - The run.
 * @param node - The variant component, or the frame layer.
 * @param label - The box's label, for change lines.
 * @param spec - The box the spec asks for.
 * @param place - Whether the box is a variant's root or a frame below it, and whether its parent
 *   turns in this run.
 * @returns `unknown` where the plan writes a field that can change the box's size: its direction,
 *   sizing, lengths, limits, padding, spacing or stroke. An absolute layer inside the box moves by
 *   its constraints when that write runs, after the plan compared the layer. `read` otherwise.
 */
export function planBox(run: Run, node: LayerParent, label: string, spec: BoxSpec, place: BoxPlace): Held {
  const { direction, sizing } = spec;
  const laidOut = recordsAny(run.plan, () => {
    planScalar(run, label, "layoutMode", node.layoutMode, direction, () => {
      node.layoutMode = direction;
    });
    planScalar(run, label, "primaryAxisAlignItems", node.primaryAxisAlignItems, spec.primaryAlign, () => {
      node.primaryAxisAlignItems = spec.primaryAlign;
    });
    planScalar(run, label, "counterAxisAlignItems", node.counterAxisAlignItems, spec.counterAlign, () => {
      node.counterAxisAlignItems = spec.counterAlign;
    });

    planLayoutSizing(
      run,
      node,
      label,
      {
        direction,
        sizing: {
          horizontal: LAYOUT_SIZING[sizing.horizontal.kind],
          vertical: LAYOUT_SIZING[sizing.vertical.kind],
        },
      },
      place.kind === "frame" ? place.parent : "read",
      (group, lengths) => {
        planLength(group, node, label, "width", sizing.horizontal, lengths, (value) =>
          node.resize(value, node.height)
        );
        planLength(group, node, label, "height", sizing.vertical, lengths, (value) =>
          node.resize(node.width, value)
        );
      }
    );
    for (const name of LIMITS) {
      planLimit(run, node, label, name, spec.limits[name]);
    }

    planNumber(run, node, label, paddingField(node, "Top"), spec.paddingTop);
    planNumber(run, node, label, paddingField(node, "Right"), spec.paddingRight);
    planNumber(run, node, label, paddingField(node, "Bottom"), spec.paddingBottom);
    planNumber(run, node, label, paddingField(node, "Left"), spec.paddingLeft);
    planNumber(
      run,
      node,
      label,
      {
        name: "itemSpacing",
        bindings: ["itemSpacing"],
        matches: (value) => near(node.itemSpacing, value),
        write: (value) => {
          node.itemSpacing = value;
        },
      },
      spec.itemSpacing
    );
  });
  planNumber(run, node, label, cornerField(node), spec.cornerRadius);

  // Figma paints a later layer above an earlier one, and the first on top with the field true (PZ2).
  const firstOnTop = spec.firstOnTop === true;
  planScalar(run, label, "itemReverseZIndex", node.itemReverseZIndex, firstOnTop, () => {
    node.itemReverseZIndex = firstOnTop;
  });

  // The build makes every root clip, for its focus ring's spread (`component-spec.ts`).
  const { clips } = spec;
  planScalar(run, label, "clipsContent", node.clipsContent, clips, () => {
    node.clipsContent = clips;
  });
  planPaints(run, label, "fill", node.fills, place.kind === "root" ? ringFill(spec) : spec.fill, (paints) => {
    node.fills = paints;
  });
  // A CSS border sits inside the box and takes room from the content, so the stroke is drawn
  // inside and counts in the auto layout. A transparent CSS border arrives as a paint with
  // alpha 0, which keeps its weight in the layout: on a real file on 2026-10-20 a default
  // Button hugged to 64px, a 42px label, 10px of padding a side and two 1px sides. A stroke drawn
  // from a CSS outline takes no room, so it stays out of the layout and overlaps the box's layers,
  // as the typings' `strokesIncludedInLayout` false draws. A border on some sides writes each side's
  // weight and counts in the layout, where each side takes room on its own side (N9, PS). The
  // layoutMode write above turns a box without auto layout into one that includes its strokes (PS3),
  // so such a box holds true once that write runs.
  const { stroke } = spec;
  const turnsOn = node.layoutMode === "NONE";
  const stroked = recordsAny(run.plan, () => {
    planPaints(run, label, "stroke", node.strokes, stroke?.color, (paints) => {
      node.strokes = paints;
    });
    if (stroke !== undefined) {
      if ("sides" in stroke) {
        planStrokeSides(run, node, label, stroke.sides);
      } else {
        planNumber(run, node, label, strokeWeightField(node), stroke.weight);
      }
      planScalar(run, label, "strokeAlign", node.strokeAlign, "INSIDE", () => {
        node.strokeAlign = "INSIDE";
      });
      const included = "sides" in stroke || stroke.inLayout !== false;
      const held = turnsOn || node.strokesIncludedInLayout;
      planScalar(run, label, "strokesIncludedInLayout", held, included, () => {
        node.strokesIncludedInLayout = included;
      });
    }
  });
  const resizes = laidOut || stroked;
  if (stroke !== undefined) {
    planDashPattern(run, node, label, "sides" in stroke ? [] : (stroke.dashPattern ?? []));
  }
  planShadows(run, node, label, spec.shadows);
  planNumber(
    run,
    node,
    label,
    {
      name: "opacity",
      bindings: ["opacity"],
      matches: (value) => Math.abs(node.opacity - value) < 0.001,
      write: (value) => {
        node.opacity = value;
      },
    },
    { kind: "literal", value: spec.opacity }
  );
  return resizes ? "unknown" : "read";
}
