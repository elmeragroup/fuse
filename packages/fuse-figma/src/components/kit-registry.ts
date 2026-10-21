/**
 * The component sets of the kit, each with the cells its preview frames place. `build-kit.ts`
 * builds a set and its previews from each entry, and `figma:compare` reads each entry's axes to
 * parse a snapshot's variant keys and to pick the self-check's cells.
 *
 * Keep this module free of Tailwind's compiler, the theme catalog and the Fuse build, so the
 * comparison loads it without them.
 */
import { BUTTON, ICON_BUTTON } from "./button-kit";
import type { Cell, ComponentDefinition } from "./component-spec";
import { axisValues } from "./kit-spec";

/** A component set of the kit and the cells its preview frames place, in frame order. */
export type KitEntry = {
  readonly definition: ComponentDefinition;
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
    previewCells: [
      ...previewCells(BUTTON, "default", { icon: "none" }),
      ...["start", "end"].flatMap((icon) =>
        axisValues(BUTTON, "variant").map((variant) => ({ variant, size: "default", state: "rest", icon }))
      ),
    ],
  },
  { definition: ICON_BUTTON, previewCells: previewCells(ICON_BUTTON, "icon", {}) },
];
