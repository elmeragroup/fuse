/**
 * The component sets of the kit, each with its page and the cells its preview frames place.
 * `build-kit.ts` builds a set from each entry and the previews of each page, and `figma:compare`
 * reads each entry's axes to parse a snapshot's variant keys and to pick the self-check's cells.
 *
 * Keep this module free of Tailwind's compiler, the theme catalog and the Fuse build, so the
 * modules that need only the definitions and their cells, such as the compare unit tests that
 * parse keys and check markup, load it without them. A comparison run loads the compiler anyway,
 * through `buildComponentSets()`.
 */
import { BADGE } from "./badge-kit";
import { BUTTON, ICON_BUTTON } from "./button-kit";
import { CHECKBOX } from "./checkbox-kit";
import { matrixCells } from "./component-spec";
import type { Cell, ComponentDefinition } from "./component-spec";
import { KBD } from "./kbd-kit";
import { axisValues } from "./kit-spec";
import { RADIO_ICON_BUTTON } from "./radio-icon-button-kit";
import { RADIO } from "./radio-kit";
import { SWITCH } from "./switch-kit";
import { ICON_TOGGLE, TOGGLE } from "./toggle-kit";

/**
 * A page of the kit: one component and its close variants, such as Button and Icon button.
 * `slug` names the page in its key, `page/button`, and in its previews' keys.
 */
export type KitPage = {
  readonly slug: string;
  readonly name: string;
};

/** The page Button and Icon button share. */
const BUTTON_PAGE: KitPage = { slug: "button", name: "Button" };

/** The page Toggle and Icon toggle share. */
const TOGGLE_PAGE: KitPage = { slug: "toggle", name: "Toggle" };

/** The page Badge sits on alone. */
const BADGE_PAGE: KitPage = { slug: "badge", name: "Badge" };

/** The page Kbd sits on alone. */
const KBD_PAGE: KitPage = { slug: "kbd", name: "Kbd" };

/** The page of the radio controls, Radio icon button first, then Radio. */
const RADIO_PAGE: KitPage = { slug: "radio", name: "Radio" };

/** The page Checkbox sits on alone. */
const CHECKBOX_PAGE: KitPage = { slug: "checkbox", name: "Checkbox" };

/** The page Switch sits on alone. */
const SWITCH_PAGE: KitPage = { slug: "switch", name: "Switch" };

/**
 * A component set of the kit, the page it sits on, and the cells its preview frames place, in
 * frame order.
 */
export type KitEntry = {
  readonly definition: ComponentDefinition;
  readonly page: KitPage;
  readonly previewCells: readonly Cell[];
};

/**
 * Every state of each variant at the base size, once for each combination of the `crossed`
 * axes' values, then each variant at rest at every other size, with each crossed axis at its
 * first value. `fixed` sets the cell's other axes.
 */
function previewCells(
  definition: ComponentDefinition,
  baseSize: string,
  fixed: Cell,
  crossed: readonly string[] = []
): Cell[] {
  const variants = axisValues(definition, "variant");
  const combinations = matrixCells(crossed.map((name) => ({ name, values: axisValues(definition, name) })));
  const resting = Object.fromEntries(crossed.map((name) => [name, axisValues(definition, name)[0] ?? ""]));
  return [
    ...variants.flatMap((variant) =>
      combinations.flatMap((combination) =>
        axisValues(definition, "state").map((state) => ({
          ...fixed,
          ...combination,
          variant,
          size: baseSize,
          state,
        }))
      )
    ),
    ...axisValues(definition, "size")
      .filter((size) => size !== baseSize)
      .flatMap((size) => variants.map((variant) => ({ ...fixed, ...resting, variant, size, state: "rest" }))),
  ];
}

/** Each variant at rest at the base size with a start icon, then with an end icon. */
function iconCells(definition: ComponentDefinition, baseSize: string, fixed: Cell): Cell[] {
  return ["start", "end"].flatMap((icon) =>
    axisValues(definition, "variant").map((variant) => ({
      ...fixed,
      variant,
      size: baseSize,
      state: "rest",
      icon,
    }))
  );
}

/** The kit's component sets, in the order the plugin places them. */
export const KIT: readonly KitEntry[] = [
  {
    definition: BUTTON,
    page: BUTTON_PAGE,
    previewCells: [...previewCells(BUTTON, "default", { icon: "none" }), ...iconCells(BUTTON, "default", {})],
  },
  { definition: ICON_BUTTON, page: BUTTON_PAGE, previewCells: previewCells(ICON_BUTTON, "icon", {}) },
  {
    definition: TOGGLE,
    page: TOGGLE_PAGE,
    previewCells: [
      ...previewCells(TOGGLE, "default", { icon: "none" }, ["pressed"]),
      ...iconCells(TOGGLE, "default", { pressed: "off" }),
    ],
  },
  {
    definition: ICON_TOGGLE,
    page: TOGGLE_PAGE,
    previewCells: previewCells(ICON_TOGGLE, "default", {}, ["pressed"]),
  },
  // A Badge has no state, so its previews place every cell of its matrix.
  { definition: BADGE, page: BADGE_PAGE, previewCells: matrixCells(BADGE.axes) },
  { definition: KBD, page: KBD_PAGE, previewCells: matrixCells(KBD.axes) },
  { definition: RADIO_ICON_BUTTON, page: RADIO_PAGE, previewCells: matrixCells(RADIO_ICON_BUTTON.axes) },
  { definition: RADIO, page: RADIO_PAGE, previewCells: matrixCells(RADIO.axes) },
  { definition: CHECKBOX, page: CHECKBOX_PAGE, previewCells: matrixCells(CHECKBOX.axes) },
  { definition: SWITCH, page: SWITCH_PAGE, previewCells: matrixCells(SWITCH.axes) },
];
