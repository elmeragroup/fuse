/**
 * The Button, Toggle, Badge and Kbd kits against hand-written expectations: which Fuse variable
 * or literal each Figma field of a cell must carry, read from `button-variants.ts`,
 * `toggle-variants.ts`, `badge-variants.ts`, `kbd-variants.ts`, `control-size.ts`,
 * `state-face.ts` and the base layer of `fuse.css`. The spec builder is the unit under test.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { PHOSPHOR_ICON_NAMES, buttonVariants } from "@elmeragroup/fuse/recipe-catalog";

import { buildKit, checkIconReferences } from "./build-kit";
import { buildComponentSet, iconKey } from "./component-spec";
import type { ComponentDefinition, IconSlot } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { ComponentRootSpec, KitSpec } from "./kit-spec";
import { compileUtilities } from "./utility-css";

let spec: KitSpec;
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await buildKit());
});

const token = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;
const density = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse density", name } }) as const;
const paint = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;
const literal = (value: number) => ({ kind: "literal", value }) as const;
const transparent = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } } as const;

function find(key: string): ComponentRootSpec {
  const found = spec.componentSets.flatMap((set) => set.variants).find((cell) => cell.key === key);
  if (found === undefined) {
    throw new Error(`the kit has no ${key}`);
  }
  return found.root;
}

function root(variant: string, size: string, state: string, icon: string): ComponentRootSpec {
  return find(`button/variant=${variant},size=${size},state=${state},icon=${icon}`);
}

function square(variant: string, size: string, state: string): ComponentRootSpec {
  return find(`icon-button/variant=${variant},size=${size},state=${state}`);
}

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "success", "link"];

/** The icon layers `button.tsx` renders, as instances of the kit's icon components. */
const startIcon = (size: number, color: ReturnType<typeof paint>) => ({
  kind: "icon",
  key: "icon-start",
  name: "Start icon",
  icon: "icon/Plus",
  swapProperty: "Start icon",
  size: literal(size),
  color,
});
const endIcon = (size: number, color: ReturnType<typeof paint>) => ({
  kind: "icon",
  key: "icon-end",
  name: "End icon",
  icon: "icon/ArrowRight",
  swapProperty: "End icon",
  size: literal(size),
  color,
});
const spinner = (size: number, color: ReturnType<typeof paint>) => ({
  kind: "icon",
  key: "spinner",
  name: "Spinner",
  icon: "icon/SpinnerGap",
  swapProperty: undefined,
  size: literal(size),
  color,
});

describe("the Button component set", () => {
  it("holds one variant per cell of the 7 × 4 × 5 × 3 matrix", () => {
    const set = spec.componentSets[0];
    // Each axis opens on the recipe's default, so the top-left variant, which Figma makes the
    // set's default, is the Button `<Button>` renders.
    expect(set?.axes).toEqual([
      { name: "variant", values: VARIANTS },
      { name: "size", values: ["default", "xs", "sm", "lg"] },
      { name: "state", values: ["rest", "hover", "focus", "disabled", "pending"] },
      { name: "icon", values: ["none", "start", "end"] },
    ]);
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(420);
    expect(set?.textProperties).toEqual([{ name: "Label", defaultValue: "Button" }]);
    // The icons the Button docs place most: Plus before the label, ArrowRight after it.
    expect(set?.swapProperties).toEqual([
      { name: "Start icon", defaultIcon: "icon/Plus" },
      { name: "End icon", defaultIcon: "icon/ArrowRight" },
    ]);
  });

  it("covers every recipe size across the two sets, except the line-sized icon-inline", () => {
    const sizes = spec.componentSets
      .filter((set) => set.page === "page/button")
      .flatMap((set) => set.axes.find((axis) => axis.name === "size")?.values ?? []);
    expect(sizes.toSorted()).toEqual(
      Object.keys(buttonVariants.variants.size)
        .filter((size) => size !== "icon-inline")
        .toSorted()
    );
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
    expect(root("default", "default", "hover", "none").fill).toEqual(paint("primary/80"));
    expect(root("default", "default", "focus", "none").shadows).toEqual([
      { color: paint("ring"), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(2) },
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
    expect(withIcon.children[0]).toEqual(startIcon(16, paint("primary-foreground")));
  });

  it("tightens the right inset for an end icon, which follows the label", () => {
    const withIcon = root("outline", "default", "rest", "end");
    expect(withIcon.paddingLeft).toEqual(density("control-px-button-md"));
    expect(withIcon.paddingRight).toEqual(density("control-px-button-icon-md"));
    expect(withIcon.children.map((child) => child.kind)).toEqual(["text", "icon"]);
    expect(withIcon.children[1]).toEqual(endIcon(16, paint("foreground")));
  });

  it("draws pending as the disabled face with a spinner in the leading slot", () => {
    // button.tsx: `isPending` disables the button, keeps it focusable, and renders SpinnerGap in a
    // span with `data-icon="inline-start"`, which takes the start inset. The recipe hides the
    // button's own leading icon, and keeps an end icon.
    const plain = root("default", "default", "pending", "none");
    expect(plain.opacity).toBe(0.5);
    expect(plain.fill).toEqual(paint("primary"));
    expect(plain.paddingLeft).toEqual(density("control-px-button-icon-md"));
    expect(plain.children.map((child) => (child.kind === "icon" ? child.key : child.kind))).toEqual([
      "spinner",
      "text",
    ]);
    expect(plain.children[0]).toEqual(spinner(16, paint("primary-foreground")));
    const withStart = root("default", "default", "pending", "start");
    expect(withStart.children.map((child) => (child.kind === "icon" ? child.key : child.kind))).toEqual([
      "spinner",
      "text",
    ]);
    const withEnd = root("ghost", "xs", "pending", "end");
    expect(withEnd.children).toEqual([
      spinner(12, paint("foreground")),
      expect.objectContaining({ kind: "text" }),
      endIcon(12, paint("foreground")),
    ]);
    expect([withEnd.paddingLeft, withEnd.paddingRight]).toEqual([
      density("control-px-button-icon-xs"),
      density("control-px-button-icon-xs"),
    ]);
  });

  it("binds xs through its 24px floor, which control-h-xs never falls below", () => {
    const xs = root("default", "xs", "rest", "start");
    expect(xs.height).toEqual(density("control-h-xs"));
    expect([xs.paddingLeft, xs.paddingRight, xs.itemSpacing]).toEqual([
      density("control-px-button-icon-xs"),
      density("control-px-button-xs"),
      density("control-gap-xs"),
    ]);
    const [icon, label] = xs.children;
    expect(icon?.kind === "icon" && icon.size).toEqual(literal(12));
    expect(label?.kind === "text" && [label.fontSize, label.lineHeight]).toEqual([literal(12), literal(16)]);
  });

  it("gives lg its own box and md's density type pair", () => {
    const lg = root("default", "lg", "rest", "none");
    expect([lg.height, lg.paddingLeft, lg.itemSpacing]).toEqual([
      density("control-h-lg"),
      density("control-px-button-lg"),
      density("control-gap-lg"),
    ]);
    const label = lg.children[0];
    expect(label?.kind === "text" && [label.fontSize, label.lineHeight]).toEqual([
      density("control-text"),
      density("control-leading"),
    ]);
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
    // Tailwind's shadow-xs, 0 1px 2px at 5% black, as formulas over the outline width.
    expect(outline.shadows).toEqual([
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.05 } },
        offsetX: 0,
        offsetY: 1,
        radius: token("button-outline-shadow-blur"),
        spread: token("button-outline-shadow-spread"),
      },
    ]);
    const hover = root("outline", "default", "hover", "none");
    expect(hover.fill).toEqual(paint("muted"));
    expect(hover.children[0]?.color).toEqual(paint("foreground"));
  });

  it("binds the error tints for the destructive button", () => {
    const rest = root("destructive", "default", "rest", "none");
    expect(rest.fill).toEqual(paint("error/10"));
    expect(rest.stroke).toEqual({ color: paint("error/20"), weight: literal(1) });
    expect(rest.children[0]?.color).toEqual(paint("error"));
    const hover = root("destructive", "default", "hover", "none");
    expect(hover.fill).toEqual(paint("error/20"));
    expect(hover.stroke?.color).toEqual(paint("error"));
  });

  it("fills the secondary button with the secondary roles", () => {
    const rest = root("secondary", "default", "rest", "none");
    expect(rest.fill).toEqual(paint("secondary"));
    expect(rest.children[0]?.color).toEqual(paint("secondary-foreground"));
    expect(root("secondary", "default", "hover", "none").fill).toEqual(paint("secondary-hover"));
  });

  it("fills the ghost button only on hover, and inherits the page text color", () => {
    const rest = root("ghost", "default", "rest", "none");
    expect(rest.fill).toBeUndefined();
    expect(rest.children[0]?.color).toEqual(paint("foreground"));
    expect(root("ghost", "default", "hover", "none").fill).toEqual(paint("muted"));
    const focus = root("ghost", "default", "focus", "none");
    expect(focus.fill).toBeUndefined();
    expect(focus.shadows).toEqual([
      { color: paint("ring"), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(2) },
    ]);
  });

  it("binds the success tints as destructive binds the error tints", () => {
    const rest = root("success", "default", "rest", "none");
    expect(rest.fill).toEqual(paint("success/10"));
    expect(rest.stroke).toEqual({ color: paint("success/20"), weight: literal(1) });
    expect(rest.children[0]?.color).toEqual(paint("success"));
    const hover = root("success", "default", "hover", "none");
    expect(hover.fill).toEqual(paint("success/20"));
    expect(hover.stroke?.color).toEqual(paint("success"));
  });

  it("draws the link as primary text that underlines 4px down on hover", () => {
    const rest = root("link", "default", "rest", "none");
    expect(rest.fill).toBeUndefined();
    const restLabel = rest.children[0];
    expect(restLabel?.kind === "text" && [restLabel.color, restLabel.underline]).toEqual([
      paint("primary"),
      undefined,
    ]);
    const hoverLabel = root("link", "default", "hover", "none").children[0];
    expect(hoverLabel?.kind === "text" && hoverLabel.underline).toEqual({ offset: 4 });
  });
});

describe("the Icon button component set", () => {
  it("holds one variant per cell of the 7 × 4 × 5 matrix, with no label", () => {
    const set = spec.componentSets[1];
    expect(set?.axes).toEqual([
      { name: "variant", values: VARIANTS },
      { name: "size", values: ["icon", "icon-xs", "icon-sm", "icon-lg"] },
      { name: "state", values: ["rest", "hover", "focus", "disabled", "pending"] },
    ]);
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(140);
    expect(set?.textProperties).toEqual([]);
    expect(set?.swapProperties).toEqual([{ name: "Icon", defaultIcon: "icon/Plus" }]);
  });

  it("squares each size on its control height around a lone icon", () => {
    const md = square("default", "icon", "rest");
    expect([md.width, md.height, md.paddingLeft, md.paddingRight]).toEqual([
      density("control-h-md"),
      density("control-h-md"),
      literal(0),
      literal(0),
    ]);
    expect(md.children).toEqual([
      {
        kind: "icon",
        key: "icon-only",
        name: "Icon",
        icon: "icon/Plus",
        swapProperty: "Icon",
        size: literal(16),
        color: paint("primary-foreground"),
      },
    ]);
    const xs = square("outline", "icon-xs", "rest");
    expect([xs.width, xs.height]).toEqual([density("control-h-xs"), density("control-h-xs")]);
    expect(xs.children[0]?.kind === "icon" && [xs.children[0].size, xs.children[0].color]).toEqual([
      literal(12),
      paint("foreground"),
    ]);
    expect(square("default", "icon-lg", "rest").width).toEqual(density("control-h-lg"));
  });

  it("shows only the spinner while pending, which takes the lone icon's place", () => {
    expect(square("secondary", "icon-sm", "pending").children).toEqual([
      spinner(16, paint("secondary-foreground")),
    ]);
  });
});

function toggle(variant: string, size: string, state: string, pressed: string): ComponentRootSpec {
  return find(`toggle/variant=${variant},size=${size},state=${state},pressed=${pressed},icon=none`);
}

describe("the Toggle component sets", () => {
  it("hold the 2 × 4 × 4 × 2 × 3 Toggle matrix and the 2 × 4 × 4 × 2 Icon toggle matrix", () => {
    const [labelled, square] = spec.componentSets.filter((set) => set.page === "page/toggle");
    expect(labelled?.axes).toEqual([
      { name: "variant", values: ["default", "outline"] },
      { name: "size", values: ["default", "xs", "sm", "lg"] },
      { name: "state", values: ["rest", "hover", "focus", "disabled"] },
      { name: "pressed", values: ["off", "on"] },
      { name: "icon", values: ["none", "start", "end"] },
    ]);
    expect(new Set(labelled?.variants.map((cell) => cell.key)).size).toBe(192);
    expect(labelled?.textProperties).toEqual([{ name: "Label", defaultValue: "Toggle" }]);
    // The docs place Star on either side.
    expect(labelled?.swapProperties).toEqual([
      { name: "Start icon", defaultIcon: "icon/Star" },
      { name: "End icon", defaultIcon: "icon/Star" },
    ]);
    expect(new Set(square?.variants.map((cell) => cell.key)).size).toBe(64);
    expect(square?.swapProperties).toEqual([{ name: "Icon", defaultIcon: "icon/Star" }]);
  });

  it("fills with muted while pressed or hovered, and with nothing at rest", () => {
    // bg-transparent paints nothing, so the root has no fill, as a ghost Button has none.
    expect(toggle("default", "default", "rest", "off").fill).toBeUndefined();
    expect(toggle("default", "default", "hover", "off").fill).toEqual(paint("muted"));
    // aria-pressed:bg-muted and enabled-hover:bg-muted agree, so pressed looks the same on hover.
    expect(toggle("default", "default", "rest", "on").fill).toEqual(paint("muted"));
    expect(toggle("default", "default", "hover", "on").fill).toEqual(paint("muted"));
    const disabled = toggle("outline", "default", "disabled", "on");
    expect([disabled.fill, disabled.opacity]).toEqual([paint("muted"), 0.5]);
  });

  it("rounds xs with the compact corner and the other sizes with radius-md", () => {
    expect(toggle("default", "xs", "rest", "off").cornerRadius).toEqual(token("radius-compact"));
    expect(toggle("default", "default", "rest", "off").cornerRadius).toEqual(token("radius-md"));
    expect(toggle("outline", "lg", "rest", "off").cornerRadius).toEqual(token("radius-md"));
  });

  it("strokes the outline Toggle with the input role and casts Tailwind's shadow-xs", () => {
    const outline = toggle("outline", "default", "rest", "off");
    expect(outline.stroke).toEqual({ color: paint("input"), weight: literal(1) });
    expect(outline.shadows).toEqual([
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.05 } },
        offsetX: 0,
        offsetY: 1,
        radius: literal(2),
        spread: literal(0),
      },
    ]);
  });

  it("gives the icon toggle's lone icon the start icon's inset", () => {
    const md = find("icon-toggle/variant=default,size=default,state=rest,pressed=off");
    expect([md.minWidth, md.paddingLeft, md.paddingRight]).toEqual([
      density("control-h-md"),
      density("control-px-icon-md"),
      density("control-px-md"),
    ]);
    expect(md.children).toEqual([
      {
        kind: "icon",
        key: "icon-only",
        name: "Icon",
        icon: "icon/Star",
        swapProperty: "Icon",
        size: literal(16),
        color: paint("foreground"),
      },
    ]);
  });
});

function badge(variant: string, size: string): ComponentRootSpec {
  return find(`badge/variant=${variant},size=${size}`);
}

/** Tailwind's shadow-xs, 0 1px 2px at 5% black. */
const SHADOW_XS = {
  color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.05 } },
  offsetX: 0,
  offsetY: 1,
  radius: literal(2),
  spread: literal(0),
} as const;

describe("the Badge component set", () => {
  it("holds every variant at the three sizes, 57 variants with a label and no state", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "badge");
    expect(set?.axes).toEqual([
      {
        name: "variant",
        values: [
          "default",
          "secondary",
          "destructive",
          "success",
          "warning",
          "info",
          "soft-destructive",
          "soft-success",
          "soft-warning",
          "soft-info",
          "outline",
          "outline-secondary",
          "outline-destructive",
          "outline-success",
          "outline-warning",
          "outline-info",
          "muted",
          "accent",
          "card",
        ],
      },
      { name: "size", values: ["default", "sm", "lg"] },
    ]);
    expect(set?.columnAxis).toBe("size");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(57);
    expect(set?.textProperties).toEqual([{ name: "Label", defaultValue: "Badge" }]);
    expect(set?.swapProperties).toEqual([]);
  });

  it("hugs the default badge's label in a primary pill with a transparent hairline and shadow-xs", () => {
    expect(badge("default", "default")).toEqual({
      name: "badge",
      width: undefined,
      height: undefined,
      minWidth: undefined,
      paddingTop: literal(2),
      paddingRight: literal(10),
      paddingBottom: literal(2),
      paddingLeft: literal(10),
      itemSpacing: literal(0),
      cornerRadius: token("radius-lg"),
      fill: paint("primary"),
      stroke: { color: transparent, weight: literal(1) },
      shadows: [SHADOW_XS],
      opacity: 1,
      children: [
        {
          kind: "text",
          key: "label",
          name: "label",
          characters: "Badge",
          textProperty: "Label",
          fontFamily: token("font-sans"),
          fontStyle: "Medium",
          fontSize: literal(12),
          lineHeight: literal(16),
          color: paint("primary-foreground"),
        },
      ],
    });
  });

  it("strokes the outline badge with the border role, which fuse.css's base layer gives every border", () => {
    const outline = badge("outline", "default");
    expect(outline.stroke).toEqual({ color: paint("border"), weight: literal(1) });
    expect([outline.fill, outline.shadows]).toEqual([undefined, []]);
    expect(outline.children[0]?.color).toEqual(paint("foreground"));
  });

  it("strokes each soft badge with its role at 20% over the soft surface", () => {
    for (const [variant, role] of [
      ["soft-destructive", "error"],
      ["soft-success", "success"],
      ["soft-warning", "warning"],
      ["soft-info", "info"],
    ]) {
      const soft = badge(variant ?? "", "default");
      expect(soft.stroke, variant).toEqual({ color: paint(`${role}/20`), weight: literal(1) });
      expect(soft.fill, variant).toEqual(paint(`${role}-soft`));
      expect(soft.children[0]?.color, variant).toEqual(paint(`${role}-soft-foreground`));
    }
  });

  it("strokes the outline status badges with their role, and outline-secondary with secondary", () => {
    expect(badge("outline-secondary", "default").stroke?.color).toEqual(paint("secondary"));
    expect(badge("outline-secondary", "default").children[0]?.color).toEqual(paint("foreground"));
    const warning = badge("outline-warning", "default");
    expect([warning.stroke?.color, warning.children[0]?.color]).toEqual([paint("warning"), paint("warning")]);
    expect(badge("outline-destructive", "default").stroke?.color).toEqual(paint("error"));
  });

  it("places every variant at every size in each preview", () => {
    const keys = new Set(
      spec.componentSets.find((set) => set.key === "badge")?.variants.map((cell) => cell.key)
    );
    const previews = spec.previews.filter((preview) => preview.page === "page/badge");
    expect(previews).toHaveLength(4);
    for (const preview of previews) {
      expect(new Set(preview.groups.flatMap((group) => group.variants))).toEqual(keys);
    }
  });

  it("pads sm tighter and lg wider, with lg's label at 14px", () => {
    const small = badge("default", "sm");
    expect([small.paddingTop, small.paddingLeft]).toEqual([literal(1), literal(8)]);
    const large = badge("secondary", "lg");
    expect([large.paddingTop, large.paddingLeft, large.fill]).toEqual([
      literal(4),
      literal(12),
      paint("secondary"),
    ]);
    const label = large.children[0];
    expect(label?.kind === "text" && [label.fontSize, label.lineHeight]).toEqual([literal(14), literal(20)]);
  });
});

function kbd(content: string): ComponentRootSpec {
  return find(`kbd/content=${content}`);
}

describe("the Kbd component set", () => {
  it("holds a text cap and an icon cap, with a Label text property and an Icon swap property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "kbd");
    expect(set?.axes).toEqual([{ name: "content", values: ["text", "icon"] }]);
    expect(set?.columnAxis).toBe("content");
    expect(set?.variants.map((cell) => cell.key)).toEqual(["kbd/content=text", "kbd/content=icon"]);
    expect(set?.textProperties).toEqual([{ name: "Label", defaultValue: "K" }]);
    expect(set?.swapProperties).toEqual([{ name: "Icon", defaultIcon: "icon/Backspace" }]);
  });

  it("draws a 20px muted cap with a border hairline around the label", () => {
    expect(kbd("text")).toEqual({
      name: "kbd",
      width: undefined,
      height: literal(20),
      minWidth: literal(20),
      paddingTop: literal(0),
      paddingRight: literal(4),
      paddingBottom: literal(0),
      paddingLeft: literal(4),
      itemSpacing: literal(4),
      cornerRadius: token("radius-sm"),
      fill: paint("muted"),
      stroke: { color: paint("border"), weight: literal(1) },
      shadows: [],
      opacity: 1,
      children: [
        {
          kind: "text",
          key: "label",
          name: "label",
          characters: "K",
          textProperty: "Label",
          fontFamily: token("font-sans"),
          fontStyle: "Medium",
          fontSize: literal(12),
          lineHeight: literal(16),
          color: paint("muted-foreground"),
        },
      ],
    });
  });

  it("holds one 12px icon in the icon cap, and no label", () => {
    const icon = kbd("icon");
    expect({ ...icon, children: [] }).toEqual({ ...kbd("text"), children: [] });
    expect(icon.children).toEqual([
      {
        kind: "icon",
        key: "icon",
        name: "Icon",
        icon: "icon/Backspace",
        swapProperty: "Icon",
        size: literal(12),
        color: paint("muted-foreground"),
      },
    ]);
  });

  it("places both caps in each preview", () => {
    const previews = spec.previews.filter((preview) => preview.page === "page/kbd");
    expect(previews).toHaveLength(4);
    for (const preview of previews) {
      expect(preview.groups.flatMap((group) => group.variants)).toEqual([
        "kbd/content=text",
        "kbd/content=icon",
      ]);
    }
  });
});

describe("the kit coverage", () => {
  it("leaves no declaration unmapped", () => {
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("reads the pending icon swap, which leaves the leading icon out", () => {
    expect(
      coverage.filter(
        (row) => row.className === "data-[pending-indicator]:[&>svg:not([data-icon=inline-end])]:hidden"
      )
    ).toContainEqual(expect.objectContaining({ property: "display", outcome: "literal" }));
  });

  it("drops the states no cell shows, and only the ones the definition omits", () => {
    const omitted = (component: string) =>
      new Set(
        coverage.flatMap((row) =>
          row.outcome === "dropped" && row.component === component
            ? (/^no cell of the matrix shows `(.+)`$/.exec(row.detail)?.[1] ?? [])
            : []
        )
      );
    expect(omitted("Button")).toEqual(
      new Set([
        "aria-invalid",
        "data-invalid",
        "aria-expanded",
        "enabled-active",
        "in-data-[slot=button-group]",
      ])
    );
    // A disabled Toggle is a native disabled button, which Base UI never marks aria-disabled.
    expect(omitted("Toggle")).toEqual(
      new Set(["aria-invalid", "data-invalid", "enabled-active", "aria-disabled"])
    );
    // A Badge's label is its own text, so no cell has the span `[&>span]` styles.
    expect(omitted("Badge")).toEqual(new Set(["[&>span]"]));
  });
});

describe("the icon reference check", () => {
  const badge: IconSlot = {
    key: "icon-badge",
    name: "Badge icon",
    side: "start",
    direct: true,
    dataIcon: "inline-start",
    icon: "Plus",
    swapProperty: "Badge icon",
  };
  const chip: ComponentDefinition = {
    key: "chip",
    name: "Chip",
    slot: "chip",
    axes: [{ name: "state", values: ["rest"] }],
    columnAxis: "state",
    classesFor: () => "text-[#000000] [&_svg]:size-[16px]",
    states: {},
    facts: new Map(),
    omittedStates: new Set(),
    label: undefined,
    iconsFor: () => [badge],
    swapProperties: [],
  };
  const library = {
    key: "icons",
    name: "Icons",
    page: "page/icons",
    size: 16,
    color: transparent,
    icons: [{ key: iconKey("Plus"), name: "Plus", svg: "<svg></svg>" }],
  };

  it("fails the build for an icon layer that links a swap property the set does not define", async () => {
    const { componentSet } = buildComponentSet(chip, {
      compiled: await compileUtilities(["text-[#000000]", "size-[16px]"]),
      variables: makeVariableIndex([]),
      page: [],
      base: [],
    });
    expect(() => checkIconReferences(componentSet, library)).toThrow(
      "chip/state=rest: the Badge icon links Badge icon, which Chip does not define"
    );
  });
});

describe("the icon library", () => {
  it("holds the roster's icons that paint with currentColor, in roster order", () => {
    // Of the bespoke icons, collect-logo.tsx, deviate-logo.tsx, funnel-logo.tsx, order-logo.tsx
    // and strom-smart.tsx paint with currentColor. The others are artwork with colors of their own.
    expect(spec.icons.icons.map((icon) => icon.name)).toEqual([
      ...PHOSPHOR_ICON_NAMES,
      "CollectLogo",
      "DeviateLogo",
      "FunnelLogo",
      "OrderLogo",
      "StromSmart",
    ]);
    expect(spec.icons.size).toBe(16);
    expect(spec.icons.color).toEqual(paint("foreground"));
  });

  it("paints each icon black for the plugin to recolor", () => {
    // Phosphor paints with currentColor; the bold Plus is one path in a 256 viewBox at 16px.
    const plus = spec.icons.icons.find((icon) => icon.name === "Plus");
    expect(plus?.key).toBe("icon/Plus");
    expect(plus?.svg).toMatch(/^<svg [^>]*width="16" height="16" fill="#000000" viewBox="0 0 256 256"/);
    expect(spec.icons.icons.filter((icon) => icon.svg.includes("currentColor"))).toEqual([]);
  });
});

describe("the preview frames", () => {
  it("put each component's sets on its own page, and the icons on a page of their own", () => {
    expect(spec.pages).toEqual([
      { key: "page/button", name: "Button" },
      { key: "page/toggle", name: "Toggle" },
      { key: "page/badge", name: "Badge" },
      { key: "page/kbd", name: "Kbd" },
      { key: "page/icons", name: "Icons" },
    ]);
    expect(spec.componentSets.map((set) => [set.key, set.page])).toEqual([
      ["button", "page/button"],
      ["icon-button", "page/button"],
      ["toggle", "page/toggle"],
      ["icon-toggle", "page/toggle"],
      ["badge", "page/badge"],
      ["kbd", "page/kbd"],
    ]);
    expect(spec.icons.page).toBe("page/icons");
  });

  it("pin four Fjordkraft private themes at Auto density on each component page, each on all five axes", () => {
    expect(spec.previews.map((preview) => [preview.key, preview.page])).toEqual(
      ["button", "toggle", "badge", "kbd"].flatMap((page) =>
        [
          "internal-fkas-private-light",
          "internal-fkas-private-dark",
          "external-fkas-private-light",
          "external-fkas-private-dark",
        ].map((theme) => [`preview/${page}/${theme}`, `page/${page}`])
      )
    );
    expect(spec.previews[3]?.modes).toEqual([
      { collection: "Fuse tokens", mode: "Dark" },
      { collection: "Fuse variant", mode: "External" },
      { collection: "Fuse segment", mode: "Private" },
      { collection: "Fuse brand", mode: "Fjordkraft" },
      { collection: "Fuse density", mode: "Auto" },
    ]);
  });

  it("give each preview a group per set on its page, each placing variants of its set", () => {
    const groups = new Map([
      [
        "page/button",
        [
          ["button", "Button"],
          ["icon-button", "Icon button"],
        ],
      ],
      [
        "page/toggle",
        [
          ["toggle", "Toggle"],
          ["icon-toggle", "Icon toggle"],
        ],
      ],
      ["page/badge", [["badge", "Badge"]]],
      ["page/kbd", [["kbd", "Kbd"]]],
    ]);
    for (const preview of spec.previews) {
      expect(preview.groups.map((group) => [group.key, group.name])).toEqual(
        groups.get(preview.page)?.map(([key, name]) => [`${preview.key}/${key}`, name])
      );
      for (const group of preview.groups) {
        const set = spec.componentSets.find((candidate) => candidate.key === group.componentSet);
        const keys = new Set(set?.variants.map((cell) => cell.key));
        expect(group.variants.length).toBeGreaterThan(0);
        expect(group.variants.every((key) => keys.has(key))).toBe(true);
      }
    }
  });

  it("loads Roboto Medium, the font-sans family every theme shares", () => {
    expect(spec.fonts).toEqual([{ family: "Roboto", style: "Medium" }]);
  });
});
