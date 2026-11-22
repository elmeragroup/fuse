/**
 * A box: a variant's component root, or a frame layer below it. Each is an auto layout frame
 * along the spec's direction that places its content as the spec's alignment says, sizes each
 * axis as fixed, hugging or filling its parent, and keeps within the spec's limits.
 */

import { ringFill } from "../../src/components/kit-spec.ts";
import type { BoxSpec, LimitsSpec, SideStroke } from "../../src/components/kit-spec.ts";
import {
  planCorners,
  LAYOUT_SIZING,
  near,
  planLayoutSizing,
  planLength,
  planLimit,
  planNumber,
  planPaints,
  planScalar,
  planEffects,
} from "./fields.ts";
import type { Held, NumberField, Run } from "./fields.ts";
import { planGridTracks } from "./grid.ts";
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

/**
 * A stroke's one weight as a number field: it matches where every side holds it and binds each
 * side, so a bound weight binds all four.
 *
 * @param node - The box, or an instance layer whose stroke goes back to its main's one weight.
 * @returns The field.
 */
export function strokeWeightField(node: LayerParent | InstanceNode): NumberField {
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
 * weight was never written, the first side write sets the other sides to 0 (PS2, FS1), and after a
 * `strokeWeight` write each side writes alone. So the change writes `strokeWeight` first, at the
 * largest side's weight, which sets all four sides and leaves no first side write to spill. Then it
 * writes each side, so every side ends at its planned weight, the sides that already matched included.
 *
 * @param run - The run.
 * @param node - The box, or an instance layer that overrides its stroke's sides.
 * @param label - The box's label, for change lines.
 * @param sides - Each side's weight.
 */
export function planStrokeSides(
  run: Run,
  node: LayerParent | InstanceNode,
  label: string,
  sides: SideStroke["sides"]
): void {
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
 * Plan Figma's aspect lock against the spec's `aspectLock`: locked at the ratio of its width and
 * height, or unlocked where the spec has none. `lockAspectRatio()` locks the ratio of the box's
 * size as it stands, and a later resize moves the lock to the new size (rule 62), so the plan writes
 * the lock after every write that can resize the box, and it compares ratios, since the box may be
 * resized in this run. A lock at another ratio locks again. A 32-bit float holds the lock, so the
 * ratio matches where it gives the spec's height within a hundredth of a pixel.
 */
function planAspectLock(run: Run, node: LayerParent, label: string, desired: BoxSpec["aspectLock"]): void {
  const held = node.targetAspectRatio;
  const matches =
    desired === undefined
      ? held === null
      : held !== null && held.x > 0 && near((held.y / held.x) * desired.width, desired.height);
  if (matches) {
    return;
  }
  const holds = held === null ? "none" : `${String(held.x)} by ${String(held.y)}`;
  if (desired === undefined) {
    change(run.plan, label, `aspect lock → none (holds ${holds})`, () => {
      node.unlockAspectRatio();
    });
    return;
  }
  change(
    run.plan,
    label,
    `aspect lock → ${String(desired.width)} by ${String(desired.height)} (holds ${holds})`,
    () => {
      node.lockAspectRatio();
    }
  );
}

/**
 * Where the box a plan draws sits. A variant's `root` sits in its component set, which never turns,
 * and gets the fill a spread shadow needs from {@link ringFill}. A `frame` below the root takes the
 * fill its spec holds, where the build already put that fill and clipping for a ring (PR2). Its
 * `parent` is `unknown` when the box that holds it turns in this run, which moves the frame's fill
 * to the other axis and can change its size.
 */
type BoxPlace = { readonly kind: "root" } | { readonly kind: "frame"; readonly parent: Held };

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
    // A frame that turns into a grid takes FLEX tracks, places its layers in no cell and fixes its
    // sizing (PG7), so its placement and tracks come next, and its sizing after them.
    planGridTracks(run, node, label, spec.grid);
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
  planCorners(run, node, label, spec.cornerRadius);

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
  // weight and counts in the layout, where each side takes room on its own side (N9, PS). A table
  // row's border in a table that collapses its borders stays out of the layout too: on some sides a
  // real file kept the row its cells' height (PG28), and on every side it takes the outline's path. The
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
      const included = stroke.inLayout !== false;
      const held = turnsOn || node.strokesIncludedInLayout;
      planScalar(run, label, "strokesIncludedInLayout", held, included, () => {
        node.strokesIncludedInLayout = included;
      });
    }
  });
  const resizes = laidOut || stroked;
  planAspectLock(run, node, label, spec.aspectLock);
  if (stroke !== undefined) {
    planDashPattern(run, node, label, "sides" in stroke ? [] : (stroke.dashPattern ?? []));
  }
  planEffects(run, node, label, spec.shadows, spec.backgroundBlur);
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
