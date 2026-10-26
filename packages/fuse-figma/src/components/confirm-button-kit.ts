/**
 * Confirm button, a set of its own on the Button page. ConfirmButton renders a Button that arms on
 * the first press and confirms on the second. Only its destructive and success variants style the
 * armed state, so the set holds those two at Button's four label sizes, in four states, armed off
 * and on: 64 cells.
 *
 * - A cell's classes are Button's recipe for its variant and size, merged with
 *   `confirmButtonVariants`, as ConfirmButton passes that recipe to Button as its `className`.
 * - An armed button fills with its role through `data-[armed=true]:`, which weighs (0,2,0) against
 *   the (0,1,0) of `enabled-hover:`, so an armed button keeps its fill on hover, and only the hover
 *   border shows.
 * - Disabling a ConfirmButton disarms it, so a disabled cell draws disarmed at `armed=on` too.
 *   Pending disarms it as well, and Button's set draws pending, so this set leaves it out.
 * - The label is the docs' Destructive demo's resting `Delete`. The demos swap in a label while
 *   armed, such as `Confirm delete`, and a designer types it on the instance, since one text
 *   property holds one default.
 */
import { buttonVariants, cn, confirmButtonVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON_LABEL_SIZES, BUTTON_OMITTED_STATES, BUTTON_PENDING_ONLY_VARIANTS } from "./button-kit";
import type { Cell, ComponentDefinition } from "./component-spec";

type RecipeVariant = keyof typeof confirmButtonVariants.variants.variant;

/** The variants `confirmButtonVariants` gives an armed face. */
const VARIANTS = ["destructive", "success"] as const satisfies readonly RecipeVariant[];

type ConfirmButtonVariant = (typeof VARIANTS)[number];
type ConfirmButtonSize = (typeof BUTTON_LABEL_SIZES)[number];

function isVariant(value: string | undefined): value is ConfirmButtonVariant {
  return VARIANTS.some((variant) => variant === value);
}

function isSize(value: string | undefined): value is ConfirmButtonSize {
  return BUTTON_LABEL_SIZES.some((size) => size === value);
}

function classesFor(cell: Cell): string {
  const { variant, size } = cell;
  if (!isVariant(variant) || !isSize(size)) {
    throw new Error(`Confirm button has no variant ${variant ?? ""} or size ${size ?? ""}`);
  }
  // Button merges the `className` it receives after its own recipe, with `cn`.
  return cn(buttonVariants({ variant, size }), confirmButtonVariants({ variant }));
}

/**
 * ConfirmButton stamps `data-armed="true"` on its Button after the first press, and drops it
 * while disabled, since turning `disabled` on disarms it.
 */
const FACTS = new Map([
  ["data-[armed=true]", (cell: Cell) => cell.armed === "on" && cell.state !== "disabled"],
]);

/**
 * Button's own omissions, and the variants only its pending state renders, which no cell of this
 * set shows. A disabled cell sets the native `disabled`. `isVisuallyDisabled` draws the same face
 * through `aria-disabled`.
 */
const OMITTED_STATES = new Set([...BUTTON_OMITTED_STATES, ...BUTTON_PENDING_ONLY_VARIANTS]);

/**
 * The label every cell shows, the default of the `Label` text property. The compare renderer
 * renders the same text.
 */
export const CONFIRM_BUTTON_LABEL = "Delete";

/** A ConfirmButton with a label, as `<ConfirmButton variant="destructive">Delete</ConfirmButton>`. */
export const CONFIRM_BUTTON: ComponentDefinition = {
  key: "confirm-button",
  name: "Confirm button",
  slot: "button",
  rootKind: "native-control",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: BUTTON_LABEL_SIZES },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
    { name: "armed", values: ["off", "on"] },
  ],
  columnAxis: "state",
  classesFor,
  states: {},
  facts: FACTS,
  omittedStates: OMITTED_STATES,
  label: {
    key: "label",
    name: "label",
    characters: CONFIRM_BUTTON_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};
