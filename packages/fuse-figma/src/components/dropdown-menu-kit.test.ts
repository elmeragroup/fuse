/**
 * Unit under test: the Dropdown menu row sets as the build produces them. Oracle: the Figma field each
 * cell must carry, read by hand from `dropdown-menu-variants.ts`, `menu-row-classes.ts` and
 * `inner-corner/menu.ts`, and the widths Chromium measured on the compare page on 2026-10-25: the docs
 * Submenu demo's sub trigger 120px wide in its popup at the popup's 128px minimum, and each other row
 * 160px wide in the 160px `<div>` its renderer gives it, at both densities.
 *
 * - An item's shortcut is `text-xs tracking-widest ml-auto text-muted-foreground
 *   group-focus/dropdown-menu-item:text-accent-foreground`: 12px type on a 16px line, 0.1em apart.
 *   Its `ml-auto` ends the row, so the row's text fills the room before it in a row packed at its
 *   start with `gap-2`. A destructive row is `text-error`, highlighted `bg-error/10`; an inset row
 *   pads its start by `calc(var(--row-px)+1.5rem)`, the synced `row-indicator-room`.
 * - A checkable row pads its end by that room. Its checked indicator, `absolute right-(--row-px)`
 *   around a 16px Check, sits in the room, so the kit draws it after the text with the row's end
 *   padded `row-px`.
 *
 * - The row is `flex min-h-(--row-h) items-center gap-2 rounded-inner px-(--row-px) py-(--row-py)`
 *   with `text-sm`, rounded with the popup's `radius-md` less `surface-pad-sm`, the synced
 *   `radius-inner/md-pad-sm`. Its text and CaretRight take `popover-foreground` from the popup, and
 *   the caret's `ml-auto` ends the row with it.
 * - `focus:bg-accent focus:text-accent-foreground` paints a highlighted row, the focus ring a focused
 *   one, and `data-popup-open:bg-accent data-popup-open:text-accent-foreground` an open one;
 *   `data-disabled:opacity-50` dims a disabled one.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  FOCUS_RING,
  HUG,
  fixed,
  literal,
  paint,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

const key = (state: string) => `dropdown-menu-sub-trigger/state=${state}`;

/** The fill, ring, opacity and text and caret colors of a cell. */
function face(state: string) {
  const root = variantRoot(spec, key(state));
  return {
    fill: root.fill,
    shadows: root.shadows,
    opacity: root.opacity,
    colors: root.children.map((layer) =>
      layer.kind === "text" || layer.kind === "icon" ? layer.color : layer.kind
    ),
  };
}

describe("the Dropdown menu sub trigger component set", () => {
  it("holds 5 states on the Dropdown menu page, its text a property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "dropdown-menu-sub-trigger");
    expect([set?.name, set?.page, set?.axes, set?.textProperties]).toEqual([
      "Dropdown menu sub trigger",
      "page/dropdown-menu",
      [{ name: "state", values: ["rest", "highlighted", "focus", "open", "disabled"] }],
      [{ name: "Label", defaultValue: "Share" }],
    ]);
  });

  it("insets the row, rounds it with its popup's inner corner and ends it with the caret", () => {
    const root = variantRoot(spec, key("rest"));
    expect(root).toMatchObject({
      sizing: { horizontal: fixed(literal(120)), vertical: HUG },
      limits: { minHeight: density("row-h") },
      paddingTop: density("row-py"),
      paddingRight: density("row-px"),
      paddingBottom: density("row-py"),
      paddingLeft: density("row-px"),
      itemSpacing: literal(8),
      counterAlign: "CENTER",
      cornerRadius: density("radius-inner/md-pad-sm"),
    });
    expect(root.children.map((layer) => [layer.kind, layer.name])).toEqual([
      ["text", "label"],
      ["icon", "CaretRight"],
    ]);
    expect(root.children[1]).toMatchObject({ size: literal(16), swapProperty: undefined });
  });

  it.each([
    [
      "rest",
      {
        fill: undefined,
        shadows: [],
        opacity: 1,
        colors: [paint("popover-foreground"), paint("popover-foreground")],
      },
    ],
    [
      "highlighted",
      {
        fill: paint("accent"),
        shadows: [],
        opacity: 1,
        colors: [paint("accent-foreground"), paint("accent-foreground")],
      },
    ],
    [
      "focus",
      {
        fill: paint("accent"),
        shadows: [FOCUS_RING],
        opacity: 1,
        colors: [paint("accent-foreground"), paint("accent-foreground")],
      },
    ],
    [
      "open",
      {
        fill: paint("accent"),
        shadows: [],
        opacity: 1,
        colors: [paint("accent-foreground"), paint("accent-foreground")],
      },
    ],
    [
      "disabled",
      {
        fill: undefined,
        shadows: [],
        opacity: 0.5,
        colors: [paint("popover-foreground"), paint("popover-foreground")],
      },
    ],
  ])("paints the %s row", (state, expected) => {
    expect(face(state)).toEqual(expected);
  });
});

describe("the Dropdown menu item component set", () => {
  it("holds 16 rows on the Dropdown menu page, its text, shortcut and icon properties", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "dropdown-menu-item");
    expect([set?.axes, set?.textProperties, set?.booleanProperties, set?.swapProperties]).toEqual([
      [
        { name: "variant", values: ["default", "destructive"] },
        { name: "inset", values: ["off", "on"] },
        { name: "state", values: ["rest", "highlighted", "focus", "disabled"] },
      ],
      [
        { name: "Label", defaultValue: "Profile" },
        { name: "Shortcut keys", defaultValue: "⇧⌘P" },
      ],
      [
        { name: "Shortcut", defaultValue: true },
        { name: "Icon", defaultValue: false },
      ],
      [{ name: "Icon glyph", defaultIcon: "icon/User" }],
    ]);
  });

  it("packs the icon, the filling text and the shortcut at the row's start", () => {
    const root = variantRoot(spec, "dropdown-menu-item/variant=default,inset=off,state=rest");
    expect(root).toMatchObject({
      sizing: { horizontal: fixed(literal(160)), vertical: HUG },
      paddingLeft: density("row-px"),
      paddingRight: density("row-px"),
      itemSpacing: literal(8),
      primaryAlign: "MIN",
    });
    const [icon, label, shortcut] = root.children;
    expect(icon).toMatchObject({
      kind: "icon",
      visibleProperty: "Icon",
      swapProperty: "Icon glyph",
      size: literal(16),
    });
    expect(label).toMatchObject({ kind: "text", sizing: { horizontal: FILL, vertical: HUG } });
    expect(shortcut).toMatchObject({
      kind: "frame",
      name: "dropdown-menu-shortcut",
      visibleProperty: "Shortcut",
      sizing: { horizontal: HUG, vertical: HUG },
      children: [
        {
          kind: "text",
          fontSize: literal(12),
          lineHeight: literal(16),
          letterSpacing: { unit: "PERCENT", value: 10 },
          color: paint("muted-foreground"),
        },
      ],
    });
  });

  it("insets an inset row's start by the indicator's room", () => {
    expect(variantRoot(spec, "dropdown-menu-item/variant=default,inset=on,state=rest").paddingLeft).toEqual(
      density("row-indicator-room")
    );
  });

  /** The fill, and the icon's, the text's and the shortcut's colors of a cell. */
  function rowFace(key: string) {
    const root = variantRoot(spec, key);
    const colors = root.children.flatMap((layer) =>
      layer.kind === "frame"
        ? layer.children.flatMap((child) => (child.kind === "text" ? [child.color] : []))
        : layer.kind === "text" || layer.kind === "icon"
          ? [layer.color]
          : []
    );
    return { fill: root.fill, colors };
  }

  it.each([
    [
      "variant=default,inset=off,state=highlighted",
      {
        fill: paint("accent"),
        colors: [paint("accent-foreground"), paint("accent-foreground"), paint("accent-foreground")],
      },
    ],
    [
      "variant=destructive,inset=off,state=rest",
      { fill: undefined, colors: [paint("error"), paint("error"), paint("muted-foreground")] },
    ],
    [
      "variant=destructive,inset=off,state=highlighted",
      { fill: paint("error/10"), colors: [paint("error"), paint("error"), paint("accent-foreground")] },
    ],
  ])("paints %s", (cell, expected) => {
    expect(rowFace(`dropdown-menu-item/${cell}`)).toEqual(expected);
  });
});

describe.each(["dropdown-menu-checkbox-item", "dropdown-menu-radio-item"])("the %s component set", (key) => {
  it("draws the checked row's indicator after the text, in the room the row keeps", () => {
    const root = variantRoot(spec, `${key}/checked=on,state=rest`);
    expect(root.paddingRight).toEqual(density("row-px"));
    expect(
      root.children.map((layer) => [layer.kind, layer.kind === "text" ? layer.sizing.horizontal : layer.name])
    ).toEqual([
      ["text", FILL],
      ["frame", `${key}-indicator`],
    ]);
    const [, indicator] = root.children;
    expect(indicator?.kind === "frame" ? indicator.children : indicator).toEqual([
      expect.objectContaining({ kind: "icon", name: "Check", size: literal(16) }),
    ]);
  });

  it("keeps the room empty while unchecked", () => {
    const root = variantRoot(spec, `${key}/checked=off,state=rest`);
    expect([root.paddingRight, root.children.map((layer) => layer.kind)]).toEqual([
      density("row-indicator-room"),
      ["text"],
    ]);
  });
});
