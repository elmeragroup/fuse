/**
 * Accordion's item, as one component set on the Accordion page: the default, card and infodropdown
 * variants at each radius, closed and open, in four trigger states, 72 cells, with columns by state.
 * A designer stacks items into an accordion.
 *
 * - The root is Base UI's `<div data-slot="accordion-item">`. Its sample renders in a 384px host.
 * - The header, an `<h3>`, holds the trigger, a native `<button>`. It shows the docs Basic demo's
 *   `Shipping`, which the `Label` property sets, and the CaretDown at its end.
 * - The label fills the room before the caret and the trigger's gap, by `spacedFirst` in
 *   `label-sizing.ts`. A label of several words wraps there and aligns each line to its start, as
 *   the trigger's `text-start` does in CSS. Figma breaks one word wider than the label. CSS keeps the
 *   word whole and widens the trigger, which pushes the caret into the item's end padding or past it.
 * - `open=true` shows the panel, which Base UI mounts only while the item is open. The panel's text is
 *   the demo's `Delivered within 3–5 business days.`, which the `Content` property sets.
 * - The trigger takes the states.
 * - `infodropdown` places the caret, `absolute right-0`, where this module declares it
 *   (`infodropdownCaret`): on the trigger's right edge, centred down, 16px square, and a half turn
 *   in an open item. The build reads no general rule for an absolute icon (#846), and
 *   `accordion-caret.chromium.test.ts` holds the declared place to Chromium's layout of the real
 *   item. The caret takes no room in the trigger's flow, so the label fills the whole trigger. Its
 *   bottom border is `Accordion.Root`'s, an element around the item that the set draws no layer for.
 * - `hasIndicator` stays at its default, the trailing caret. The docs Leading indicator demo drops
 *   the caret for a leading icon of its own, and crossing it would double the set to 144 cells.
 */
import { accordionVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import type { DeclaredIconPlace } from "./declared-icon-place";
import { ownKey } from "./own-key";
import { always } from "./popup-facts";

/** The width the kit's previews and the compare host give an item, which its block box fills. */
export const ACCORDION_PREVIEW_WIDTH = 384;

/** The trigger's text, the default of its `Label` property: the docs Basic demo's first trigger. */
export const ACCORDION_TRIGGER_TEXT = "Shipping";

/** The panel's text, the default of its `Content` property: the docs Basic demo's first panel. */
export const ACCORDION_CONTENT_TEXT = "Delivered within 3–5 business days.";

type AccordionVariant = keyof typeof accordionVariants.variants.variant;
type AccordionRadius = keyof typeof accordionVariants.variants.radius;

/** The variants the set draws, in the recipe's order. */
const VARIANTS = ["default", "card", "infodropdown"] as const satisfies readonly AccordionVariant[];

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
  return { variant, radius, open: cell.open === "true" };
}

const showsOpen = (cell: Cell): boolean => accordionLook(cell).open;

/** The caret `Accordion.Trigger` renders by default, as a manifest names it. */
const CARET: IconManifest = {
  key: "caret",
  name: "Caret",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretDown",
  swapProperty: undefined,
};

/**
 * The caret of an `infodropdown` item, where this module declares it sits: `absolute right-0` in the
 * `relative flex items-center` trigger, which has no padding or border, puts its right edge on the
 * trigger's right edge and its centre on the trigger's centre. `size-4` makes it 16px square, and
 * `group-data-[panel-open]/accordion-trigger:rotate-180` turns it a half turn in an open item.
 */
function infodropdownCaret(open: boolean): IconManifest {
  const placed: DeclaredIconPlace = {
    set: "accordion-item",
    part: "trigger",
    icon: "CaretDown",
    variant: "infodropdown",
    end: 0,
    size: 16,
    turn: open ? 180 : 0,
  };
  return { ...CARET, placed };
}

/** The caret a cell's trigger renders: at its declared place in an `infodropdown` item, else in the flow. */
function caretOf(cell: Cell): IconManifest {
  const { variant, open } = accordionLook(cell);
  return variant === "infodropdown" ? infodropdownCaret(open) : CARET;
}

/**
 * The item's manifest, which the capture-backed build reads with `captures/accordion-item.json`: an
 * Accordion item, as `<Accordion.Root variant radius>` around one `Accordion.Item`, open through the
 * root's `defaultValue`, disabled through the item's `disabled`, in a 384px container. It names the
 * header around the trigger, and the open panel around the `<div>` at its first place, which holds
 * its text. The trigger, a native `<button>`, takes the states. The style Base UI writes on the
 * panel comes from the capture.
 */
export const ACCORDION_ITEM_MANIFEST: SetManifest = {
  key: "accordion-item",
  name: "Accordion item",
  api: { page: "accordion", parts: ["Accordion.Root", "Accordion.Item"] },
  slot: "accordion-item",
  statePart: "accordion-trigger",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "radius", values: RADII },
    { name: "open", values: ["false", "true"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: ACCORDION_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: "accordion-header",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "trigger",
          slot: "accordion-trigger",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: ACCORDION_TRIGGER_TEXT,
            textProperty: "Label",
            shownIn: always,
          },
          iconsFor: (cell) => [caretOf(cell)],
        },
      ],
    },
    {
      key: "content",
      slot: "accordion-content",
      shownIn: showsOpen,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "content-inner",
          slot: undefined,
          place: "accordion-content/0",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: ACCORDION_CONTENT_TEXT,
            textProperty: "Content",
            shownIn: always,
          },
          iconsFor: () => [],
        },
      ],
    },
  ],
  swapProperties: [],
};
