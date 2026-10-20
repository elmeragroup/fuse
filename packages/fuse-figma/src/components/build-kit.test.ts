/**
 * The Button kit against hand-written expectations: which Fuse variable or literal each Figma
 * field of a cell must carry, read from `button-variants.ts`, `control-size.ts` and
 * `state-face.ts`. The spec builder is the unit under test.
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
    const sizes = spec.componentSets.flatMap(
      (set) => set.axes.find((axis) => axis.name === "size")?.values ?? []
    );
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

describe("the Button coverage", () => {
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
    const omitted = new Set(
      coverage.flatMap((row) =>
        row.outcome === "dropped" ? (/^no cell of the matrix shows `(.+)`$/.exec(row.detail)?.[1] ?? []) : []
      )
    );
    expect(omitted).toEqual(
      new Set([
        "aria-invalid",
        "data-invalid",
        "aria-expanded",
        "enabled-active",
        "in-data-[slot=button-group]",
      ])
    );
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
    conditions: new Map(),
    omittedStates: new Set(),
    childSelectors: new Map([["[&_svg]", () => true]]),
    label: undefined,
    iconsFor: () => [badge],
    swapProperties: [],
  };
  const library = {
    key: "icons",
    name: "Icons",
    size: 16,
    color: transparent,
    icons: [{ key: iconKey("Plus"), name: "Plus", svg: "<svg></svg>" }],
  };

  it("fails the build for an icon layer that links a swap property the set does not define", async () => {
    const { componentSet } = buildComponentSet(chip, {
      compiled: await compileUtilities(["text-[#000000]", "size-[16px]"]),
      variables: makeVariableIndex([]),
      page: [],
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
  it("pin three themes at both densities for each set, each on all five axes", () => {
    expect(spec.previews.map((preview) => preview.key)).toEqual(
      [
        "internal-fkas-private-light/dense",
        "internal-fkas-private-light/comfortable",
        "internal-elma-company-dark/dense",
        "internal-elma-company-dark/comfortable",
        "external-fkas-private-light/dense",
        "external-fkas-private-light/comfortable",
      ].flatMap((theme) => [`preview/button/${theme}`, `preview/icon-button/${theme}`])
    );
    expect(spec.previews[4]?.modes).toEqual([
      { collection: "Fuse tokens", mode: "Dark" },
      { collection: "Fuse variant", mode: "Internal" },
      { collection: "Fuse segment", mode: "Company" },
      { collection: "Fuse brand", mode: "Elmera" },
      { collection: "Fuse density", mode: "Dense" },
    ]);
    for (const preview of spec.previews) {
      const set = spec.componentSets.find((candidate) => candidate.key === preview.componentSet);
      const keys = new Set(set?.variants.map((cell) => cell.key));
      expect(preview.variants.length).toBeGreaterThan(0);
      expect(preview.variants.every((key) => keys.has(key))).toBe(true);
    }
  });

  it("loads Roboto Medium, the font-sans family every theme shares", () => {
    expect(spec.fonts).toEqual([{ family: "Roboto", style: "Medium" }]);
  });
});
