/**
 * Which forced-state cells the kit itself draws the same as at rest. The unit under test is
 * `unchangedByDesign`, and the oracle is the fixture set below: a pressed chip fills with muted
 * at rest and on hover, and a focus ring changes it on focus.
 */
import { describe, expect, it } from "vitest";

import { NO_LIMITS } from "../components/kit-spec";
import type { ComponentRootSpec, VariantSpec } from "../components/kit-spec";
import { tokenColorsIn, unchangedByDesign } from "./unchanged-by-design";

const muted = { kind: "variable", variable: { collection: "Fuse tokens", name: "muted" } } as const;
const zero = { kind: "literal", value: 0 } as const;

const ROOT: ComponentRootSpec = {
  name: "chip",
  direction: "HORIZONTAL",
  sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
  limits: NO_LIMITS,
  clips: true,
  paddingTop: zero,
  paddingRight: zero,
  paddingBottom: zero,
  paddingLeft: zero,
  itemSpacing: zero,
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: zero,
  fill: muted,
  stroke: undefined,
  shadows: [],
  opacity: 1,
  children: [],
};

function variant(state: string, root: ComponentRootSpec): VariantSpec {
  return { key: `chip/state=${state},pressed=on`, properties: { state, pressed: "on" }, root };
}

describe("unchangedByDesign", () => {
  it("holds a forced cell whose spec equals its resting twin's, and not one whose spec differs", () => {
    const ring = {
      color: muted,
      offsetX: 0,
      offsetY: 0,
      radius: zero,
      spread: { kind: "literal", value: 2 },
    } as const;
    const set = {
      key: "chip",
      axes: [
        { name: "state", values: ["rest", "hover", "focus"] },
        { name: "pressed", values: ["on"] },
      ],
      variants: [
        variant("rest", ROOT),
        // A copy, so equality is by value as the JSON spec compares.
        variant("hover", { ...ROOT, fill: { ...muted } }),
        variant("focus", { ...ROOT, shadows: [ring] }),
      ],
    };
    expect(unchangedByDesign([set], () => undefined)).toEqual(new Set(["chip/state=hover,pressed=on"]));
  });

  // A hovered Sidebar menu badge paints `sidebar-accent-foreground` where it paints
  // `sidebar-foreground` at rest. Where the preview's theme gives both one color, the hover face is
  // the rest face; where it gives them two, or does not resolve them, it is not.
  it("holds a forced cell whose token colors resolve to its resting twin's in the theme", () => {
    const token = (name: string) =>
      ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;
    const text = (name: string) => ({
      ...ROOT,
      fill: undefined,
      shadows: [],
      stroke: { color: token(name), weight: zero },
    });
    const set = {
      key: "chip",
      axes: [
        { name: "state", values: ["rest", "hover"] },
        { name: "pressed", values: ["on"] },
      ],
      variants: [
        variant("rest", text("sidebar-foreground")),
        variant("hover", text("sidebar-accent-foreground")),
      ],
    };
    const black = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
    const white = { kind: "literal", color: { r: 1, g: 1, b: 1, a: 1 } } as const;
    const alike = (name: string) => (name.startsWith("sidebar") ? black : undefined);
    const apart = (name: string) => (name === "sidebar-foreground" ? black : white);
    expect([
      unchangedByDesign([set], alike),
      unchangedByDesign([set], apart),
      unchangedByDesign([set], () => undefined),
    ]).toEqual([new Set(["chip/state=hover,pressed=on"]), new Set(), new Set()]);
  });
});

// Unit under test: `tokenColorsIn`, the theme a preview stamps resolved for each token. Oracle:
// `defaults.ts`, which gives `sidebar-foreground` and `sidebar-accent-foreground` both
// `NEUTRAL_950` and `sidebar-accent` `NEUTRAL_LINE`, and `internal-dark-palette.ts`, which gives the
// first two `oklch(0.985 0 0)` in the internal dark theme.
describe("tokenColorsIn", () => {
  it.each(["light", "dark"] as const)(
    "resolves the internal Fjordkraft private %s theme's sidebar text tokens to one color, and the accent fill to another",
    (scheme) => {
      const colorOf = tokenColorsIn({
        scheme,
        variant: "internal",
        brand: "fkas",
        segment: "private",
        density: "dense",
      });
      const text = colorOf("sidebar-foreground");
      expect(text).toMatchObject({ kind: "literal" });
      expect(colorOf("sidebar-accent-foreground")).toEqual(text);
      expect(colorOf("sidebar-accent")).not.toEqual(text);
      expect(colorOf("radius-md")).toBeUndefined();
    }
  );
});
