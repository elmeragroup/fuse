/**
 * Accordion's item, as one component set on the Accordion page: the default and card variants at
 * each radius, closed and open, in four trigger states, 48 cells, with columns by state. A designer
 * stacks items into an accordion.
 *
 * - The root is Base UI's `<div data-slot="accordion-item">` with the `item` slot of
 *   `accordionVariants`, a block box 384px wide that stacks the header and the panel down it. It
 *   pads with `--surface-pad-md` and draws the variant's fill and corner: `default` the soft primary
 *   tint on `rounded-sm`, `card` the card fill and a 1px `card-border` edge on `rounded-lg`, and `lg`
 *   or `xl` the larger rung.
 * - The header, an `<h3>`, holds the trigger, a native `<button>` that fills the header's row. It
 *   shows the docs Basic demo's `Shipping` in the host's 16/24 type at Medium, which the `Label`
 *   property sets, and the 16px CaretDown at its end.
 * - `open=on` holds `group-data-[panel-open]/accordion-trigger`, which Base UI stamps on an open
 *   item's trigger, so the caret turns half a turn, and shows the panel, which Base UI mounts only
 *   while the item is open. The panel's text is the demo's `Delivered within 3–5 business days.`,
 *   which the `Content` property sets, below the large surface gap plus 6px (`accordion-panel-pt`).
 *   A card panel rounds with the item's inner corner.
 * - The trigger takes the states: hover underlines its label, focus draws the 2px ring, and a
 *   disabled item dims the trigger to 50%.
 * - `hasIndicator` stays at its default, the trailing caret. The docs Leading indicator demo drops
 *   the caret for a leading icon of its own, and crossing it would double the set to 96 cells. The
 *   `infodropdown` variant draws a bottom border alone, which needs per-side strokes.
 */
import { accordionVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, IconSlot, OuterDeclaration, PartDefinition } from "./component-spec";
import { HOST_TYPE } from "./host-type";
import { ownKey } from "./own-key";

/** The width the kit's previews and the compare host give an item, which its block box fills. */
export const ACCORDION_PREVIEW_WIDTH = 384;

/** The trigger's text, the default of its `Label` property: the docs Basic demo's first trigger. */
export const ACCORDION_TRIGGER_TEXT = "Shipping";

/** The panel's text, the default of its `Content` property: the docs Basic demo's first panel. */
export const ACCORDION_CONTENT_TEXT = "Delivered within 3–5 business days.";

type AccordionVariant = keyof typeof accordionVariants.variants.variant;
type AccordionRadius = keyof typeof accordionVariants.variants.radius;

/** The variants the set draws: the recipe's, but the `infodropdown` with its bottom border only. */
const VARIANTS = ["default", "card"] as const satisfies readonly AccordionVariant[];

function isVariant(value: string | undefined): value is (typeof VARIANTS)[number] {
  return VARIANTS.some((variant) => variant === value);
}

function isRadius(value: string | undefined): value is AccordionRadius {
  return ownKey(accordionVariants.variants.radius, value);
}

/** The radii in the recipe's order, its default first. */
const RADII = Object.keys(accordionVariants.variants.radius).filter(isRadius);

/** What a cell renders: the item's variant and radius, and whether it is open. */
export type AccordionLook = {
  readonly variant: (typeof VARIANTS)[number];
  readonly radius: AccordionRadius;
  readonly open: boolean;
};

/**
 * What an `accordion-item` cell renders.
 *
 * @param cell - An `accordion-item` cell.
 * @returns Its look.
 * @throws When the cell names a variant or radius the set does not declare, a defect in the
 *   caller's cell.
 */
export function accordionLook(cell: Cell): AccordionLook {
  const { variant, radius } = cell;
  if (!isVariant(variant) || !isRadius(radius)) {
    throw new Error(`Accordion item has no variant ${variant ?? ""} or radius ${radius ?? ""}`);
  }
  return { variant, radius, open: cell.open === "on" };
}

/** The recipe's slots in a cell's variant and radius, with the default trailing caret. */
function slotsFor(cell: Cell) {
  const { variant, radius } = accordionLook(cell);
  return accordionVariants({ variant, radius });
}

/**
 * The display the browser's default style sheet gives a `<div>`, which the item, the panel and the
 * panel's text box are, and which no class of theirs sets.
 */
const DIV_BLOCK: readonly OuterDeclaration[] = [
  { className: "user agent style sheet, div", property: "display", value: "block" },
];

const always = (): boolean => true;
const showsOpen = (cell: Cell): boolean => accordionLook(cell).open;

/** The caret `Accordion.Trigger` renders by default, CaretDown with the `icon` slot's classes. */
function caret(cell: Cell): IconSlot {
  return {
    key: "caret",
    name: "Caret",
    side: "end",
    direct: true,
    dataIcon: undefined,
    icon: "CaretDown",
    swapProperty: undefined,
    classes: slotsFor(cell).icon(),
  };
}

/** The trigger, the native `<button>` that toggles the item, holding its label and the caret. */
const TRIGGER: PartDefinition = {
  key: "trigger",
  slot: "accordion-trigger",
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).trigger(),
  label: {
    key: "text",
    name: "text",
    characters: ACCORDION_TRIGGER_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: (cell) => [caret(cell)],
};

const HEADER: PartDefinition = {
  key: "header",
  slot: "accordion-header",
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).header(),
  label: undefined,
  iconsFor: () => [],
  parts: [TRIGGER],
};

/** The `<div>` inside the panel that holds the panel's text below the panel's top padding. */
const CONTENT_INNER: PartDefinition = {
  key: "content-inner",
  slot: undefined,
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).contentInner(),
  elementDefaults: DIV_BLOCK,
  label: {
    key: "text",
    name: "text",
    characters: ACCORDION_CONTENT_TEXT,
    textProperty: "Content",
    shownIn: always,
  },
  iconsFor: () => [],
};

/**
 * The panel, which Base UI mounts only while the item is open, with the style Base UI writes on it
 * there: the measured height and width it animates between, `auto` once it is open, and no
 * animation.
 */
const PANEL: PartDefinition = {
  key: "content",
  slot: "accordion-content",
  shownIn: showsOpen,
  classesFor: (cell) => slotsFor(cell).content(),
  elementDefaults: DIV_BLOCK,
  styleFor: () => [
    { property: "--accordion-panel-height", value: "auto" },
    { property: "--accordion-panel-width", value: "auto" },
    { property: "animation-name", value: "none" },
  ],
  label: undefined,
  iconsFor: () => [],
  parts: [CONTENT_INNER],
};

/**
 * An Accordion item, as `<Accordion.Root variant radius>` around one `Accordion.Item` holding its
 * header, trigger and content, open through the root's `defaultValue`, disabled through the item's
 * `disabled`, in a 384px container.
 */
export const ACCORDION_ITEM: ComponentDefinition = {
  key: "accordion-item",
  name: "Accordion item",
  slot: "accordion-item",
  // The trigger is the native `<button>` that takes hover, focus and a disabled item's `disabled`.
  rootKind: "native-control",
  statePart: "accordion-trigger",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "radius", values: RADII },
    { name: "open", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: ACCORDION_PREVIEW_WIDTH,
  inheritedFor: () => HOST_TYPE,
  elementDefaults: DIV_BLOCK,
  classesFor: (cell) => slotsFor(cell).item(),
  states: {},
  facts: new Map([
    ["group-data-[panel-open]/accordion-trigger", showsOpen],
    // Base UI stamps `data-orientation="vertical"` on the item and its parts, which fuse.css's
    // `data-vertical:` reads. No class reads it here.
    ["data-vertical", always],
  ]),
  // Base UI disables the trigger natively and never marks it `aria-disabled`. It holds the panel's
  // starting and ending styles only while the panel opens or closes, which no static cell shows.
  omittedStates: new Set(["aria-disabled", "data-starting-style", "data-ending-style"]),
  label: undefined,
  iconsFor: () => [],
  parts: [HEADER, PANEL],
  swapProperties: [],
};
