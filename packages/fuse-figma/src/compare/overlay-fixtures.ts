/**
 * The self-check's overlay fixtures: definitions outside the kit whose cells the self-check renders
 * as client cells, to prove that a client cell mounts, measures, forces its state and passes the
 * markup check. Each names its rendering in `overlay-fixture-cell.ts` as a {@link ClientSource},
 * the shape a kit set's client renderer takes in `SOURCES`. This module imports no Fuse build, so the
 * build check can read the fixtures' entries before any rendering loads.
 *
 * The definitions describe the markup Fuse renders, with no classes: the self-check compares the
 * browser with itself, and the markup check reads their parts, labels and icons.
 */

import type { Cell, ComponentDefinition, PartDefinition } from "../components/component-spec.ts";
import type { ClientSource } from "./cell-renderers.ts";

/**
 * The fill a fixture cell's measured element shows just inside its start edge, written by hand from
 * the compiled CSS: none, where the element paints no background and the page hides the popup
 * around it, or a `Fuse tokens` color the theme resolves.
 */
export type FixtureFill = { readonly _tag: "None" } | { readonly _tag: "Token"; readonly token: string };

/** A fixture: its definition, its client renderer's source, and the cells the self-check renders. */
export type OverlayFixture = {
  readonly definition: ComponentDefinition;
  readonly source: ClientSource;
  readonly cells: readonly Cell[];
  /** The fill each cell must show, for a fixture whose face the self-check checks by hand. */
  readonly fill?: (cell: Cell) => FixtureFill;
};

const MODULE = new URL("overlay-fixture-cell.ts", import.meta.url);

/** The text of the Popover fixtures' title, description and trigger, and of the rows. */
export const FIXTURE_TEXT = {
  title: "Delivery",
  description: "Choose when the order arrives.",
  trigger: "Open",
  menuItem: "Rename",
  selectItems: ["Apple", "Banana"],
} as const;

/** The value of the Select fixture's selected item, its second. */
export const SELECTED_FIXTURE_VALUE = "banana";

function definition(
  fields: Pick<ComponentDefinition, "key" | "name" | "slot" | "axes"> &
    Partial<Pick<ComponentDefinition, "element" | "elementSlot" | "label" | "parts" | "iconsFor" | "facts">>
): ComponentDefinition {
  return {
    columnAxis: fields.axes[0]?.name ?? "",
    classesFor: () => "",
    states: {},
    facts: new Map(),
    omittedStates: new Set(),
    label: undefined,
    iconsFor: () => [],
    swapProperties: [],
    ...fields,
  };
}

function textPart(key: string, slot: string, characters: string): PartDefinition {
  return {
    key,
    slot,
    shownIn: () => true,
    classesFor: () => "",
    label: { key, name: key, characters, textProperty: undefined, shownIn: () => true },
    iconsFor: () => [],
  };
}

const HEADER: PartDefinition = {
  key: "header",
  slot: "popover-header",
  shownIn: () => true,
  classesFor: () => "",
  label: undefined,
  iconsFor: () => [],
  parts: [
    textPart("title", "popover-title", FIXTURE_TEXT.title),
    textPart("description", "popover-description", FIXTURE_TEXT.description),
  ],
};

const POPUP: PartDefinition = {
  key: "popup",
  slot: "popover-content",
  shownIn: () => true,
  classesFor: () => "",
  label: undefined,
  iconsFor: () => [],
  parts: [HEADER],
};

/**
 * What Base UI stamps on an open popup below its trigger, `data-open` and its side, which the popup's
 * motion classes read.
 */
const OPEN_BELOW = new Map([
  ["data-open", () => true],
  ["data-[side=bottom]", () => true],
]);

const CONTENT = [{ name: "content", values: ["header"] }];
const HIGHLIGHT = [{ name: "state", values: ["rest", "highlighted"] }];

/** The self-check's overlay fixtures. */
export const OVERLAY_FIXTURES: readonly OverlayFixture[] = [
  {
    definition: definition({
      key: "fixture-popover",
      name: "Popover popup",
      slot: "popover-content",
      axes: CONTENT,
      parts: [HEADER],
      facts: OPEN_BELOW,
    }),
    source: {
      set: "fixture-popover",
      entry: "dist/popover.js",
      module: { url: MODULE, name: "popoverPopup" },
    },
    cells: [{ content: "header" }],
  },
  {
    // The markup check reads an open composite's trigger and popup under one root that carries the
    // composite's slot, as the Figma frame holds both.
    definition: definition({
      key: "fixture-popover-open",
      name: "Popover (open)",
      slot: "popover-open",
      axes: CONTENT,
      parts: [textPart("trigger", "popover-trigger", FIXTURE_TEXT.trigger), POPUP],
      facts: OPEN_BELOW,
    }),
    source: {
      set: "fixture-popover-open",
      entry: "dist/popover.js",
      module: { url: MODULE, name: "popoverOpen" },
    },
    cells: [{ content: "header" }],
  },
  {
    definition: definition({
      key: "fixture-menu-item",
      name: "Dropdown menu item",
      slot: "dropdown-menu-item",
      axes: HIGHLIGHT,
      label: {
        key: "label",
        name: "Label",
        characters: FIXTURE_TEXT.menuItem,
        textProperty: undefined,
        shownIn: () => true,
      },
    }),
    source: {
      set: "fixture-menu-item",
      entry: "dist/dropdown-menu.js",
      module: { url: MODULE, name: "menuItem" },
    },
    cells: [{ state: "rest" }, { state: "highlighted" }],
  },
  {
    // The selected one of two items. Base UI marks it highlighted on open, which the mount clears, so
    // only the highlighted cell draws Fuse's `focus:` face. Its text sits in a classed `<div>` and
    // its Check in a bare `<span>`, neither with a `data-slot`.
    definition: definition({
      key: "fixture-select-item",
      name: "Select item",
      slot: "select-item",
      element: { tag: "div", attributes: { "data-slot": "select-item", "aria-selected": "true" } },
      elementSlot: () => "select-item",
      axes: HIGHLIGHT,
      parts: [
        {
          key: "text",
          slot: undefined,
          element: { tag: "div", attributes: {} },
          shownIn: () => true,
          classesFor: () => "",
          label: {
            key: "label",
            name: "Label",
            characters: FIXTURE_TEXT.selectItems[1],
            textProperty: undefined,
            shownIn: () => true,
          },
          iconsFor: () => [],
        },
        {
          key: "indicator",
          slot: undefined,
          element: { tag: "span", attributes: { "aria-hidden": "true" } },
          shownIn: () => true,
          classesFor: () => "",
          label: undefined,
          iconsFor: () => [
            {
              key: "check",
              name: "Check",
              side: "end",
              direct: true,
              dataIcon: undefined,
              icon: "Check",
              swapProperty: undefined,
              classes: "pointer-events-none",
            },
          ],
        },
      ],
    }),
    source: {
      set: "fixture-select-item",
      entry: "dist/select.js",
      module: { url: MODULE, name: "selectItem" },
    },
    cells: [{ state: "rest" }, { state: "highlighted" }],
    // Fuse's built Select item paints `background-color: var(--accent)` under `focus:bg-accent` and
    // no background otherwise.
    fill: (cell) => (cell.state === "highlighted" ? { _tag: "Token", token: "accent" } : { _tag: "None" }),
  },
];
