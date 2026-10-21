/**
 * The component sets of the kit, each with its page and the cells its preview frames place.
 * `build-kit.ts` builds a set from each entry and the previews of each page, and `figma:compare`
 * reads each entry's axes to parse a snapshot's variant keys and to pick the self-check's cells.
 *
 * Keep this module free of Tailwind's compiler, the theme catalog and the Fuse build, so the
 * comparison loads it without them.
 */
import { BUTTON, ICON_BUTTON } from "./button-kit";
import type { Cell, ComponentDefinition } from "./component-spec";
import { axisValues } from "./kit-spec";

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
 * Every state of each variant at the base size, then each variant at rest at every other
 * size. `fixed` sets the cell's other axes.
 */
function previewCells(definition: ComponentDefinition, baseSize: string, fixed: Cell): Cell[] {
  const variants = axisValues(definition, "variant");
  return [
    ...variants.flatMap((variant) =>
      axisValues(definition, "state").map((state) => ({ ...fixed, variant, size: baseSize, state }))
    ),
    ...axisValues(definition, "size")
      .filter((size) => size !== baseSize)
      .flatMap((size) => variants.map((variant) => ({ ...fixed, variant, size, state: "rest" }))),
  ];
}

/** The kit's component sets, in the order the plugin places them. */
export const KIT: readonly KitEntry[] = [
  {
    definition: BUTTON,
    page: BUTTON_PAGE,
    previewCells: [
      ...previewCells(BUTTON, "default", { icon: "none" }),
      ...["start", "end"].flatMap((icon) =>
        axisValues(BUTTON, "variant").map((variant) => ({ variant, size: "default", state: "rest", icon }))
      ),
    ],
  },
  { definition: ICON_BUTTON, page: BUTTON_PAGE, previewCells: previewCells(ICON_BUTTON, "icon", {}) },
];
