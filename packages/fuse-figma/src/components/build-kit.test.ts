/**
 * The Button kit against hand-written expectations: which Fuse variable or literal each Figma
 * field of a cell must carry, read from `button-variants.ts`, `control-size.ts` and
 * `state-face.ts`. The spec builder is the unit under test.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { buildKit } from "./build-kit";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec, KitSpec } from "./kit-spec";

let spec: KitSpec;
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await buildKit());
});

const token = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;
const density = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse density", name } }) as const;
const paint = (name: string, opacity = 1) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name }, opacity }) as const;
const literal = (value: number) => ({ kind: "literal", value }) as const;
const transparent = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } } as const;

function root(variant: string, size: string, state: string, icon: string): ComponentRootSpec {
  const key = `button/variant=${variant},size=${size},state=${state},icon=${icon}`;
  const found = spec.componentSets[0]?.variants.find((cell) => cell.key === key);
  if (found === undefined) {
    throw new Error(`the kit has no ${key}`);
  }
  return found.root;
}

describe("the Button component set", () => {
  it("holds one variant per cell of the 3 × 2 × 4 × 2 matrix", () => {
    const set = spec.componentSets[0];
    expect(set?.axes).toEqual([
      { name: "variant", values: ["default", "outline", "destructive"] },
      { name: "size", values: ["default", "sm"] },
      { name: "state", values: ["rest", "hover", "focus", "disabled"] },
      { name: "icon", values: ["none", "start"] },
    ]);
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(48);
    expect(set?.textProperties).toEqual([{ name: "Label", defaultValue: "Button" }]);
  });

  it("binds the default md button to the control metrics, radius and primary roles", () => {
    expect(root("default", "default", "rest", "none")).toEqual({
      name: "button",
      height: density("control-h-md"),
      minWidth: undefined,
      paddingTop: literal(0),
      paddingRight: density("control-px-button-md"),
      paddingBottom: literal(0),
      paddingLeft: density("control-px-button-md"),
      itemSpacing: density("control-gap-md"),
      cornerRadius: token("radius-button"),
      fill: paint("primary"),
      stroke: { color: transparent, weight: literal(1) },
      shadows: [],
      opacity: 1,
      children: [
        {
          kind: "text",
          key: "label",
          name: "label",
          characters: "Button",
          textProperty: "Label",
          fontFamily: token("font-sans"),
          fontStyle: "Medium",
          fontSize: density("control-text"),
          lineHeight: density("control-leading"),
          color: paint("primary-foreground"),
        },
      ],
    });
  });

  it("maps hover, focus and disabled onto the state axis", () => {
    expect(root("default", "default", "hover", "none").fill).toEqual(paint("primary", 0.8));
    expect(root("default", "default", "focus", "none").shadows).toEqual([
      { color: paint("ring"), offsetX: 0, offsetY: 0, radius: 0, spread: 2 },
    ]);
    const disabled = root("default", "default", "disabled", "none");
    expect(disabled.opacity).toBe(0.5);
    expect(disabled.fill).toEqual(paint("primary"));
  });

  it("tightens the left inset for a start icon and draws the icon at 16px", () => {
    const withIcon = root("default", "default", "rest", "start");
    expect(withIcon.paddingLeft).toEqual(density("control-px-button-icon-md"));
    expect(withIcon.paddingRight).toEqual(density("control-px-button-md"));
    expect(withIcon.children.map((child) => child.kind)).toEqual(["icon", "text"]);
    expect(withIcon.children[0]).toEqual({
      kind: "icon",
      key: "icon",
      name: "icon",
      size: literal(16),
      color: paint("primary-foreground"),
    });
  });

  it("sets sm type in fixed pixels, since only md and lg follow density", () => {
    const small = root("default", "sm", "rest", "none");
    expect(small.height).toEqual(density("control-h-sm"));
    expect(small.paddingLeft).toEqual(density("control-px-button-sm"));
    const label = small.children[0];
    expect(label?.kind === "text" && [label.fontSize, label.lineHeight]).toEqual([literal(14), literal(20)]);
  });

  it("strokes the outline button with the outline role and width, and inherits the page text color", () => {
    const outline = root("outline", "default", "rest", "none");
    expect(outline.fill).toEqual(paint("background"));
    expect(outline.stroke).toEqual({ color: paint("button-outline"), weight: token("button-outline-width") });
    expect(outline.children[0]?.color).toEqual(paint("foreground"));
    const hover = root("outline", "default", "hover", "none");
    expect(hover.fill).toEqual(paint("muted"));
    expect(hover.children[0]?.color).toEqual(paint("foreground"));
  });

  it("mixes the error role for the destructive button", () => {
    const rest = root("destructive", "default", "rest", "none");
    expect(rest.fill).toEqual(paint("error", 0.1));
    expect(rest.stroke).toEqual({ color: paint("error", 0.2), weight: literal(1) });
    expect(rest.children[0]?.color).toEqual(paint("error"));
    const hover = root("destructive", "default", "hover", "none");
    expect(hover.fill).toEqual(paint("error", 0.2));
    expect(hover.stroke?.color).toEqual(paint("error"));
  });
});

describe("the Button coverage", () => {
  it("leaves only the outline shadow unmapped, whose blur and spread are formulas over a variable", () => {
    expect(coverage.filter((row) => row.outcome === "unmapped").map((row) => row.className)).toEqual([
      "shadow-[0_1px_max(0px,4px-2*var(--button-outline-width,1px))_min(0px,2px-2*var(--button-outline-width,1px))_rgb(0_0_0/0.05)]",
    ]);
  });

  it("drops the states no cell shows", () => {
    const dropped = new Set(coverage.filter((row) => row.outcome === "dropped").map((row) => row.className));
    for (const className of [
      "aria-invalid:border-error",
      "aria-expanded:bg-muted",
      "enabled-active:not-aria-[haspopup]:translate-y-px",
    ]) {
      expect(dropped).toContain(className);
    }
  });
});

describe("the preview frames", () => {
  it("pin three themes at both densities, each on all five axes", () => {
    expect(spec.previews.map((preview) => preview.key)).toEqual([
      "preview/internal-fkas-private-light/dense",
      "preview/internal-fkas-private-light/comfortable",
      "preview/internal-elma-company-dark/dense",
      "preview/internal-elma-company-dark/comfortable",
      "preview/external-fkas-private-light/dense",
      "preview/external-fkas-private-light/comfortable",
    ]);
    expect(spec.previews[2]?.modes).toEqual([
      { collection: "Fuse tokens", mode: "Dark" },
      { collection: "Fuse variant", mode: "Internal" },
      { collection: "Fuse segment", mode: "Company" },
      { collection: "Fuse brand", mode: "Elmera" },
      { collection: "Fuse density", mode: "Dense" },
    ]);
    const keys = new Set(spec.componentSets[0]?.variants.map((cell) => cell.key));
    for (const preview of spec.previews) {
      expect(preview.variants.every((key) => keys.has(key))).toBe(true);
    }
  });

  it("loads Roboto Medium, the font-sans family every theme shares", () => {
    expect(spec.fonts).toEqual([{ family: "Roboto", style: "Medium" }]);
  });
});
