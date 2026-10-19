/**
 * A variant's component root: a horizontal auto layout box that hugs its content along the
 * row and centers it on both axes.
 */

import type { ComponentRootSpec } from "../../src/components/kit-spec.ts";
import { near, syncNumber, syncPaints, syncScalar, syncShadows } from "./fields.ts";
import type { NumberField, Run } from "./fields.ts";
import { change } from "./ledger.ts";

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
 * Bring a variant's root in line with the spec. The root hugs its content along the row and
 * centers it on both axes, as an `inline-flex items-center justify-center` box does.
 *
 * @param run - The run.
 * @param node - The variant component.
 * @param label - The variant's label, for change lines.
 * @param spec - The root the spec asks for.
 */
export function syncRoot(run: Run, node: ComponentNode, label: string, spec: ComponentRootSpec): void {
  syncScalar(run, label, "layoutMode", node.layoutMode, "HORIZONTAL", () => {
    node.layoutMode = "HORIZONTAL";
  });
  syncScalar(run, label, "primaryAxisAlignItems", node.primaryAxisAlignItems, "CENTER", () => {
    node.primaryAxisAlignItems = "CENTER";
  });
  syncScalar(run, label, "counterAxisAlignItems", node.counterAxisAlignItems, "CENTER", () => {
    node.counterAxisAlignItems = "CENTER";
  });

  // `resize` turns both sizing modes to FIXED, so the height comes before the sizing modes.
  if (spec.height === undefined) {
    if (node.boundVariables?.height !== undefined) {
      change(run.ledger, label, "height → hug", () => node.setBoundVariable("height", null));
    }
  } else {
    syncNumber(
      run,
      node,
      label,
      {
        name: "height",
        bindings: ["height"],
        matches: (value) => near(node.height, value),
        write: (value) => node.resize(node.width, value),
      },
      spec.height
    );
  }
  syncScalar(run, label, "primaryAxisSizingMode", node.primaryAxisSizingMode, "AUTO", () => {
    node.primaryAxisSizingMode = "AUTO";
  });
  const counterSizing = spec.height === undefined ? "AUTO" : "FIXED";
  syncScalar(run, label, "counterAxisSizingMode", node.counterAxisSizingMode, counterSizing, () => {
    node.counterAxisSizingMode = counterSizing;
  });

  if (spec.minWidth === undefined) {
    if (node.minWidth !== null || node.boundVariables?.minWidth !== undefined) {
      change(run.ledger, label, "minWidth → none", () => {
        node.setBoundVariable("minWidth", null);
        node.minWidth = null;
      });
    }
  } else {
    syncNumber(
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

  syncNumber(run, node, label, paddingField(node, "Top"), spec.paddingTop);
  syncNumber(run, node, label, paddingField(node, "Right"), spec.paddingRight);
  syncNumber(run, node, label, paddingField(node, "Bottom"), spec.paddingBottom);
  syncNumber(run, node, label, paddingField(node, "Left"), spec.paddingLeft);
  syncNumber(
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
  syncNumber(run, node, label, cornerField(node), spec.cornerRadius);

  syncPaints(run, label, "fill", node.fills, spec.fill, (paints) => {
    node.fills = paints;
  });
  // A CSS border sits inside the box and takes room from the content, so the stroke is drawn
  // inside and counts in the auto layout. A transparent CSS border arrives as a paint with
  // alpha 0, which keeps its weight in the layout. Unverified on a real file: whether Figma
  // counts the weight of a stroke whose only paint is fully transparent.
  syncPaints(run, label, "stroke", node.strokes, spec.stroke?.color, (paints) => {
    node.strokes = paints;
  });
  if (spec.stroke !== undefined) {
    syncNumber(run, node, label, strokeWeightField(node), spec.stroke.weight);
    syncScalar(run, label, "strokeAlign", node.strokeAlign, "INSIDE", () => {
      node.strokeAlign = "INSIDE";
    });
    syncScalar(run, label, "strokesIncludedInLayout", node.strokesIncludedInLayout, true, () => {
      node.strokesIncludedInLayout = true;
    });
  }
  syncShadows(run, node, label, spec.shadows);
  syncNumber(
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
