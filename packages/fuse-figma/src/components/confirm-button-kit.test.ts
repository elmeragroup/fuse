/**
 * Unit under test: the Confirm button component set as the build produces it. Oracle: the Fuse
 * variable or literal each Figma field of a cell must carry, read by hand from
 * `button-variants.ts`, `confirm-button-variants.ts` and the compiled `styles.css`, where
 * `data-[armed=true]:` selects `[data-armed="true"]` at (0,2,0) and `enabled-hover:` keeps one
 * class's weight, (0,1,0), and from `confirm-button.tsx`, which disarms a disabled button. A
 * disarmed cell is cross-checked against the Button cell of its variant, size and state, which
 * `build-kit.test.ts` pins by hand: ConfirmButton renders that Button, and its recipe adds nothing
 * while disarmed.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  fixed,
  FOCUS_RING,
  HUG,
  HUGGING_LABEL,
  literal,
  paint,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ColorSpec, ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function confirm(variant: string, size: string, state: string, armed: string): ComponentRootSpec {
  return variantRoot(spec, `confirm-button/variant=${variant},size=${size},state=${state},armed=${armed}`);
}

/** The root of a Button cell with its label's characters replaced. */
function relabelled(root: ComponentRootSpec, characters: string): ComponentRootSpec {
  return {
    ...root,
    children: root.children.map((child) => (child.kind === "text" ? { ...child, characters } : child)),
  };
}

/** The color of a root's label, its one layer. */
function labelColor(root: ComponentRootSpec): ColorSpec | undefined {
  const [label] = root.children;
  return label?.kind === "text" ? label.color : undefined;
}

const VARIANTS = ["destructive", "success"];

/** Each variant with the role its armed face fills with. */
const ROLES = [
  ["destructive", "error"],
  ["success", "success"],
] as const;
const SIZES = ["default", "xs", "sm", "lg"];
const STATES = ["rest", "hover", "focus", "disabled"];

describe("the Confirm button component set", () => {
  it("holds the 2 × 4 × 4 × 2 matrix on the Button page, with columns by state and the demo's label", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "confirm-button");
    expect([set?.name, set?.page]).toEqual(["Confirm button", "page/button"]);
    expect(set?.axes).toEqual([
      { name: "variant", values: VARIANTS },
      { name: "size", values: SIZES },
      { name: "state", values: STATES },
      { name: "armed", values: ["off", "on"] },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(64);
    // The docs' Destructive demo rests on `Delete`.
    expect(set?.textProperties).toEqual([{ name: "Label", defaultValue: "Delete" }]);
    expect(set?.swapProperties).toEqual([]);
  });

  it("draws each disarmed cell as the Button of its variant, size and state, with its own label", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        for (const state of STATES) {
          const button = variantRoot(spec, `button/variant=${variant},size=${size},state=${state},icon=none`);
          expect(confirm(variant, size, state, "off"), `${variant} ${size} ${state}`).toEqual(
            relabelled(button, "Delete")
          );
        }
      }
    }
  });

  it("fills an armed destructive button with error under error-foreground text, inside the error/20 border", () => {
    expect(confirm("destructive", "default", "rest", "on")).toEqual({
      name: "button",
      direction: "HORIZONTAL",
      sizing: { horizontal: HUG, vertical: fixed(density("control-h-md")) },
      limits: UNLIMITED,
      clips: true,
      paddingTop: literal(0),
      paddingRight: density("control-px-button-md"),
      paddingBottom: literal(0),
      paddingLeft: density("control-px-button-md"),
      itemSpacing: density("control-gap-md"),
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      cornerRadius: token("radius-button"),
      fill: paint("error"),
      stroke: { color: paint("error/20"), weight: literal(1) },
      shadows: [],
      opacity: 1,
      children: [
        {
          kind: "text",
          key: "label",
          name: "label",
          characters: "Delete",
          textProperty: "Label",
          fontFamily: token("font-sans"),
          fontStyle: "Medium",
          fontSize: density("control-text"),
          lineHeight: density("control-leading"),
          color: paint("error-foreground"),
          ...HUGGING_LABEL,
        },
      ],
    });
  });

  it("keeps the armed fill on hover, where only the border turns to the role, and rings it on focus", () => {
    for (const [variant, role] of ROLES) {
      const hover = confirm(variant, "default", "hover", "on");
      expect([hover.fill, hover.stroke?.color, labelColor(hover)]).toEqual([
        paint(role),
        paint(role),
        paint(`${role}-foreground`),
      ]);
      const focus = confirm(variant, "default", "focus", "on");
      expect([focus.fill, focus.shadows]).toEqual([paint(role), [FOCUS_RING]]);
    }
  });

  it("fills an armed success button with success under success-foreground text at every size", () => {
    for (const size of SIZES) {
      const armed = confirm("success", size, "rest", "on");
      expect([armed.fill, armed.stroke?.color, labelColor(armed)], size).toEqual([
        paint("success"),
        paint("success/20"),
        paint("success-foreground"),
      ]);
    }
  });

  it("draws an armed disabled cell disarmed, since disabling a ConfirmButton disarms it", () => {
    for (const [variant, role] of ROLES) {
      const disabled = confirm(variant, "default", "disabled", "on");
      expect(disabled).toEqual(confirm(variant, "default", "disabled", "off"));
      expect([disabled.opacity, disabled.fill]).toEqual([0.5, paint(`${role}/10`)]);
    }
  });

  it("drops Button's group corners, its pending face and the states no Button cell shows", () => {
    const omitted = new Set(
      coverage.flatMap((row) =>
        row.outcome === "dropped" && row.component === "Confirm button"
          ? (/^no cell of the matrix shows `(.+)`$/.exec(row.detail)?.[1] ?? [])
          : []
      )
    );
    expect(omitted).toEqual(
      new Set([
        "aria-invalid",
        "data-invalid",
        "enabled-active",
        "in-data-[slot=button-group]",
        "aria-disabled",
        "data-[pending-indicator]",
      ])
    );
  });
});
