/**
 * Unit under test: Navigation menu's four bar and row sets as the build produces them. Oracle: the
 * Fuse variable or literal each Figma field of a cell must carry, read by hand from
 * `navigationMenuVariants` in `navigation-menu-variants.ts`, the md control rung in
 * `control-size-md.ts`, the focus ring in `styles/utils.ts`, the state face in `state-face.ts`,
 * Tailwind's spacing and type scales, the attributes Base UI's static markup stamps on a trigger and
 * a link, and the docs demos:
 *
 * - The bar trigger hugs `Customers` and a 16px CaretDown on the md control rung: `control-h-md` tall,
 *   `control-px-md` across, `control-gap-md` apart, centered, on `rounded-md`, at Medium in the
 *   control type pair and the page's `foreground`. Hover and open fill it `muted`. Its caret paints
 *   `muted-foreground` and turns half a turn while open, disabled too, through
 *   `data-[side=bottom]:group-data-popup-open/navigation-menu-trigger:rotate-180`.
 * - The vertical trigger is the docs Nested demo's 288px row: at least `row-h` tall, padded `row-px`
 *   across and `row-py` down, `Electric car` at 14/20 Regular, which `font-[number:inherit]` takes from
 *   a page that sets no weight, and the caret, on `rounded-sm`. The label fills the room the caret and
 *   the 8px gap leave, which CSS keeps as the least space under `justify-between` (CSS Box Alignment 3
 *   §8), so the row packs the two at its start with the gap between them, where a real file drew
 *   SPACE_BETWEEN with no gap beside a filling text (PV). Its Root opens its popup on its right, so
 *   `data-[side=right]:-rotate-90` turns the caret a quarter turn counterclockwise, 90 in Figma, in
 *   every cell. Hover and open fill the row `accent` and paint the label and, through `**:`, the caret
 *   `accent-foreground`.
 * - The bar link hugs `Overview` on the md control rung at Medium, which `data-active:font-medium`
 *   repeats, in `foreground`, which `data-active:text-foreground` repeats, so an active bar link draws
 *   as an inactive one. Hover fills it `muted`.
 * - The row link is the docs Basic demo's 256px row, `Electricity` at 14/20 in `foreground`, Medium
 *   while active, filling the row. Hover fills it `accent` and paints the label `accent-foreground`.
 * - Focus draws the 2px `ring` on each, and a disabled trigger dims to 50% through `aria-disabled:`,
 *   which Base UI stamps in place of the native attribute.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  FOCUS_RING,
  HUG,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

const TRIGGER_STATES = ["rest", "hover", "focus", "disabled"];
const LINK_STATES = ["rest", "hover", "focus"];
const OFF_ON = ["off", "on"];

/** Every cell of a set with the state axis and a second off/on axis. */
const cells = (states: readonly string[]) =>
  states.flatMap((state) => OFF_ON.map((on) => [state, on] as const));

function trigger(set: string, state: string, open: string): ComponentRootSpec {
  return variantRoot(spec, `navigation-menu-${set}-trigger/state=${state},open=${open}`);
}

function link(set: string, state: string, active: string): ComponentRootSpec {
  return variantRoot(spec, `navigation-menu-${set}-link/state=${state},active=${active}`);
}

/** The set with a key. */
function setOf(key: string) {
  return spec.componentSets.find((candidate) => candidate.key === key);
}

/** The root's box: its direction, sizing, limits, paddings, gap, alignments and corner. */
function boxOf(root: ComponentRootSpec) {
  return {
    direction: root.direction,
    sizing: root.sizing,
    limits: root.limits,
    paddings: [root.paddingTop, root.paddingRight, root.paddingBottom, root.paddingLeft],
    gap: root.itemSpacing,
    align: [root.primaryAlign, root.counterAlign],
    corner: root.cornerRadius,
  };
}

/** The root's text layer. */
function textOf(root: ComponentRootSpec) {
  const text = root.children.find((child) => child.kind === "text");
  return text?.kind === "text" ? text : undefined;
}

/** The root's caret. */
function caretOf(root: ComponentRootSpec) {
  const caret = root.children.find((child) => child.kind === "icon");
  return caret?.kind === "icon" ? caret : undefined;
}

/** What a state face draws: the fill, the ring and the opacity. */
function faceOf(root: ComponentRootSpec) {
  return { fill: root.fill, shadows: root.shadows, opacity: root.opacity };
}

/** The face of a cell in a state, with a fill where the cell is filled. */
function face(state: string, fill: ReturnType<typeof paint> | undefined) {
  return {
    fill,
    shadows: state === "focus" ? [FOCUS_RING] : [],
    opacity: state === "disabled" ? 0.5 : 1,
  };
}

/** The md control rung's box, which the bar trigger and the bar link take, hugging their content. */
const BAR_BOX = {
  direction: "HORIZONTAL",
  sizing: { horizontal: HUG, vertical: fixed(density("control-h-md")) },
  limits: {},
  paddings: [literal(0), density("control-px-md"), literal(0), density("control-px-md")],
  gap: density("control-gap-md"),
  align: ["CENTER", "CENTER"],
  corner: token("radius-md"),
};

/** A content row's box, which the vertical trigger and the row link take, at a width. */
const rowBox = (width: number, primary: string) => ({
  direction: "HORIZONTAL",
  sizing: { horizontal: fixed(literal(width)), vertical: HUG },
  limits: { minHeight: density("row-h") },
  paddings: [density("row-py"), density("row-px"), density("row-py"), density("row-px")],
  gap: literal(8),
  align: [primary, "CENTER"],
  corner: token("radius-sm"),
});

/** The label of a bar part on the md control rung at Medium in the page's `foreground`. */
const barLabel = (characters: string) => ({
  characters,
  textProperty: "Label",
  fontFamily: token("font-sans"),
  fontStyle: "Medium",
  fontSize: density("control-text"),
  lineHeight: density("control-leading"),
  color: paint("foreground"),
  sizing: { horizontal: HUG, vertical: HUG },
});

/** The label of a row at 14/20 that fills the room the row leaves it. */
const rowLabel = (characters: string, fontStyle: string, color: string) => ({
  characters,
  textProperty: "Label",
  fontFamily: token("font-sans"),
  fontStyle,
  fontSize: literal(14),
  lineHeight: literal(20),
  color: paint(color),
  sizing: { horizontal: FILL, vertical: HUG },
});

/** The parts of a text layer the expectations name. */
function labelOf(root: ComponentRootSpec) {
  const text = textOf(root);
  return {
    characters: text?.characters,
    textProperty: text?.textProperty,
    fontFamily: text?.fontFamily,
    fontStyle: text?.fontStyle,
    fontSize: text?.fontSize,
    lineHeight: text?.lineHeight,
    color: text?.color,
    sizing: text?.sizing,
  };
}

describe("Navigation menu's bar and row sets", () => {
  it("lay out the two triggers and the two links on the Navigation menu page", () => {
    const sets = [
      "navigation-menu-bar-trigger",
      "navigation-menu-vertical-trigger",
      "navigation-menu-bar-link",
      "navigation-menu-row-link",
    ].map(setOf);
    expect(sets.map((set) => [set?.name, set?.page, set?.columnAxis, set?.variants.length])).toEqual([
      ["Navigation menu bar trigger", "page/navigation-menu", "state", 8],
      ["Navigation menu vertical trigger", "page/navigation-menu", "state", 8],
      ["Navigation menu bar link", "page/navigation-menu", "state", 6],
      ["Navigation menu row link", "page/navigation-menu", "state", 6],
    ]);
    expect(sets.map((set) => set?.axes)).toEqual([
      [
        { name: "state", values: TRIGGER_STATES },
        { name: "open", values: OFF_ON },
      ],
      [
        { name: "state", values: TRIGGER_STATES },
        { name: "open", values: OFF_ON },
      ],
      [
        { name: "state", values: LINK_STATES },
        { name: "active", values: OFF_ON },
      ],
      [
        { name: "state", values: LINK_STATES },
        { name: "active", values: OFF_ON },
      ],
    ]);
    expect(sets.map((set) => [set?.textProperties, set?.swapProperties])).toEqual([
      [[{ name: "Label", defaultValue: "Customers" }], []],
      [[{ name: "Label", defaultValue: "Electric car" }], []],
      [[{ name: "Label", defaultValue: "Overview" }], []],
      [[{ name: "Label", defaultValue: "Electricity" }], []],
    ]);
  });
});

describe("the bar trigger", () => {
  it.each(cells(TRIGGER_STATES))("draws the md control box at %s, open %s", (state, open) => {
    expect(boxOf(trigger("bar", state, open))).toEqual(BAR_BOX);
  });

  it.each(cells(TRIGGER_STATES))("fills muted while hovered or open, at %s, open %s", (state, open) => {
    const filled = state === "hover" || open === "on";
    expect(faceOf(trigger("bar", state, open))).toEqual(face(state, filled ? paint("muted") : undefined));
  });

  it.each(cells(TRIGGER_STATES))(
    "holds Customers and a muted caret that turns half a turn while open, at %s, open %s",
    (state, open) => {
      const root = trigger("bar", state, open);
      expect(labelOf(root)).toEqual(barLabel("Customers"));
      const { rotation, ...caret } = caretOf(root) ?? {};
      expect(caret).toEqual({
        kind: "icon",
        key: "caret",
        name: "Caret",
        icon: "icon/CaretDown",
        swapProperty: undefined,
        size: literal(16),
        color: paint("muted-foreground"),
      });
      expect(rotation).toBe(open === "on" ? 180 : undefined);
      expect(root.children.map((child) => child.kind)).toEqual(["text", "icon"]);
    }
  );
});

describe("the vertical trigger", () => {
  it.each(cells(TRIGGER_STATES))("draws the 288px content row at %s, open %s", (state, open) => {
    expect(boxOf(trigger("vertical", state, open))).toEqual(rowBox(288, "MIN"));
  });

  it.each(cells(TRIGGER_STATES))(
    "fills accent and paints its label and caret accent-foreground while hovered or open, at %s, open %s",
    (state, open) => {
      const root = trigger("vertical", state, open);
      const lit = state === "hover" || open === "on";
      expect(faceOf(root)).toEqual(face(state, lit ? paint("accent") : undefined));
      expect(labelOf(root)).toEqual(
        rowLabel("Electric car", "Regular", lit ? "accent-foreground" : "foreground")
      );
      expect([caretOf(root)?.color, caretOf(root)?.rotation]).toEqual([
        paint(lit ? "accent-foreground" : "muted-foreground"),
        90,
      ]);
    }
  );
});

describe("the bar link", () => {
  it.each(cells(LINK_STATES))("draws the md control box and Overview at %s, active %s", (state, active) => {
    const root = link("bar", state, active);
    expect(boxOf(root)).toEqual(BAR_BOX);
    expect(labelOf(root)).toEqual(barLabel("Overview"));
    expect(faceOf(root)).toEqual(face(state, state === "hover" ? paint("muted") : undefined));
    expect(root.children.map((child) => child.kind)).toEqual(["text"]);
  });
});

describe("the row link", () => {
  it.each(cells(LINK_STATES))(
    "draws the 256px content row and Electricity at %s, active %s",
    (state, active) => {
      const root = link("row", state, active);
      expect(boxOf(root)).toEqual(rowBox(256, "CENTER"));
      expect(labelOf(root)).toEqual(
        rowLabel(
          "Electricity",
          active === "on" ? "Medium" : "Regular",
          state === "hover" ? "accent-foreground" : "foreground"
        )
      );
      expect(faceOf(root)).toEqual(face(state, state === "hover" ? paint("accent") : undefined));
    }
  );

  it("leaves out the popup's inner corner and the recolour of what a row holds below its text", () => {
    const rows = coverage
      .filter(
        (row) =>
          row.component === "Navigation menu row link" &&
          (row.className.startsWith("in-data-[slot=navigation-menu-popup]") || row.className.includes("**:"))
      )
      .map((row) => [row.className, row.outcome, row.detail]);
    expect(rows).toEqual([
      [
        "in-data-[slot=navigation-menu-popup]:[:where(&)]:rounded-inner",
        "dropped",
        "a row inside the Navigation menu's popup, which waits for the popup's set",
      ],
      [
        "hover:**:text-accent-foreground",
        "dropped",
        "no element sits below the box in any cell, so the class styles nothing the set draws",
      ],
    ]);
  });
});
