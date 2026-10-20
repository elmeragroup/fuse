/**
 * A variant's component root: a horizontal auto layout box that centers its content on both
 * axes, and hugs it along the row unless the spec fixes a width, as an icon square does.
 */

import type { ColorSpec, ComponentRootSpec, NumberSpec } from "../../src/components/kit-spec.ts";
import { near, planNumber, planPaints, planScalar, planShadows, planSizing } from "./fields.ts";
import type { NumberField, Run } from "./fields.ts";
import { change } from "./plan.ts";

function paddingField(node: ComponentNode, side: "Top" | "Right" | "Bottom" | "Left"): NumberField {
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

function cornerField(node: ComponentNode): NumberField {
  const corners = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;
  return {
    name: "cornerRadius",
    bindings: corners,
    matches: (value) => corners.every((corner) => near(node[corner], value)),
    write: (value) => {
      node.cornerRadius = value;
    },
  };
}

function strokeWeightField(node: ComponentNode): NumberField {
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
 * A fill Figma counts as visible that changes no 8-bit channel: black at an alpha below half a
 * step, 1/510, moves a channel by less than 0.5, which rounds away. Figma does not count a fill
 * at alpha 0. On a real file on 2026-10-20, ghost and link focus rings held their 2px spread
 * over such a fill and drew nothing, and a test frame drew the ring once its fill reached 0.001.
 */
const CLEAR: ColorSpec = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.0015 } };

/**
 * The fill a root needs. Figma draws a drop shadow's spread only from a frame that clips its
 * content and has a visible fill, and a focus ring is a spread shadow. A root without a fill,
 * such as a ghost Button, therefore gets one that shows nothing, as CSS paints nothing for an
 * unset `background-color`.
 *
 * @param spec - The root the spec asks for.
 * @returns The fill to plan, or undefined for none.
 */
export function rootFill(spec: Pick<ComponentRootSpec, "fill" | "shadows">): ColorSpec | undefined {
  const spreads = spec.shadows.some(
    (shadow) => shadow.spread.kind === "variable" || shadow.spread.value !== 0
  );
  return spec.fill ?? (spreads ? CLEAR : undefined);
}

/** Plan a fixed width or height, or unbind one the spec lets the root hug. */
function planSize(
  run: Run,
  node: ComponentNode,
  label: string,
  name: "width" | "height",
  spec: NumberSpec | undefined,
  write: (value: number) => void
): void {
  if (spec === undefined) {
    if (node.boundVariables?.[name] !== undefined) {
      change(run.plan, label, `${name} → hug`, () => node.setBoundVariable(name, null));
    }
    return;
  }
  planNumber(
    run,
    node,
    label,
    { name, bindings: [name], matches: (value) => near(node[name], value), write },
    spec
  );
}

/**
 * Plan a variant's root against the spec. The root centers its content on both axes, as an
 * `inline-flex items-center justify-center` box does, and hugs it where the spec fixes no size.
 *
 * @param run - The run.
 * @param node - The variant component.
 * @param label - The variant's label, for change lines.
 * @param spec - The root the spec asks for.
 */
export function planRoot(run: Run, node: ComponentNode, label: string, spec: ComponentRootSpec): void {
  planScalar(run, label, "layoutMode", node.layoutMode, "HORIZONTAL", () => {
    node.layoutMode = "HORIZONTAL";
  });
  planScalar(run, label, "primaryAxisAlignItems", node.primaryAxisAlignItems, "CENTER", () => {
    node.primaryAxisAlignItems = "CENTER";
  });
  planScalar(run, label, "counterAxisAlignItems", node.counterAxisAlignItems, "CENTER", () => {
    node.counterAxisAlignItems = "CENTER";
  });

  const { width, height } = spec;
  planSizing(
    run,
    node,
    label,
    (group) => {
      planSize(group, node, label, "width", width, (value) => node.resize(value, node.height));
      planSize(group, node, label, "height", height, (value) => node.resize(node.width, value));
    },
    { primary: width === undefined ? "AUTO" : "FIXED", counter: height === undefined ? "AUTO" : "FIXED" }
  );

  if (spec.minWidth === undefined) {
    if (node.minWidth !== null || node.boundVariables?.minWidth !== undefined) {
      change(run.plan, label, "minWidth → none", () => {
        node.setBoundVariable("minWidth", null);
        node.minWidth = null;
      });
    }
  } else {
    planNumber(
      run,
      node,
      label,
      {
        name: "minWidth",
        bindings: ["minWidth"],
        matches: (value) => node.minWidth !== null && near(node.minWidth, value),
        write: (value) => {
          node.minWidth = value;
        },
      },
      spec.minWidth
    );
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
  planNumber(run, node, label, cornerField(node), spec.cornerRadius);

  // The first run on a real file stored the focus ring's 2px spread as 0 on a root that did
  // not clip. Clipping costs nothing here, since every child sits inside the padding.
  planScalar(run, label, "clipsContent", node.clipsContent, true, () => {
    node.clipsContent = true;
  });
  planPaints(run, label, "fill", node.fills, rootFill(spec), (paints) => {
    node.fills = paints;
  });
  // A CSS border sits inside the box and takes room from the content, so the stroke is drawn
  // inside and counts in the auto layout. A transparent CSS border arrives as a paint with
  // alpha 0, which keeps its weight in the layout: on a real file on 2026-10-20 a default
  // Button hugged to 64px, a 42px label, 10px of padding a side and two 1px sides.
  planPaints(run, label, "stroke", node.strokes, spec.stroke?.color, (paints) => {
    node.strokes = paints;
  });
  if (spec.stroke !== undefined) {
    planNumber(run, node, label, strokeWeightField(node), spec.stroke.weight);
    planScalar(run, label, "strokeAlign", node.strokeAlign, "INSIDE", () => {
      node.strokeAlign = "INSIDE";
    });
    planScalar(run, label, "strokesIncludedInLayout", node.strokesIncludedInLayout, true, () => {
      node.strokesIncludedInLayout = true;
    });
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
}
