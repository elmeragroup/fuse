/**
 * Checkbox card, as one component set on a page of its own: the docs default demo's card, unchecked
 * and checked, at rest, focused and disabled, in each `variant`: 12 cells, with columns by `state`.
 *
 * - The root is the card's `Card.Root`, `<div data-slot="card">`, in a host as wide as a Field.
 * - The content is `<div data-slot="card-content">`, a row around the card's `<label>`.
 * - The control is the checkbox's `<span role="checkbox">`, the label's first element, which takes
 *   the set's focus. It stacks `Circle` and the `fill` weight of `CheckCircle` in one grid cell and
 *   crossfades them by opacity. Each cell draws the icon its state shows, as `stacked-cell.ts` reads
 *   it: `Circle` unchecked and `CheckCircle` checked.
 * - Base UI's hidden `<input>` follows the control, fixed and clipped, so it draws nothing.
 * - The text column follows it: the title in a column of its own, then the description. Each text
 *   is the docs default demo's, and a TEXT property sets it: `Title` and `Description`.
 *
 * The card has no hover style, so the set has no hover cell: a forced hover matches no rule. The set
 * draws no `tags`, `children` or `rightContent`.
 */
import type { IconManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The width the kit's previews and the compare host give the card, a Field's width. */
export const CHECKBOX_CARD_PREVIEW_WIDTH = 384;

/** The value the card adds to its group, the docs default demo's. */
export const CHECKBOX_CARD_VALUE = "insurance";

/** The title's text, the default of its `Title` property: the docs default demo's. */
export const CHECKBOX_CARD_TITLE = "Insurance";

/** The description's text, the default of its `Description` property: the docs default demo's. */
export const CHECKBOX_CARD_DESCRIPTION = "Covers theft and water damage.";

/**
 * Whether a cell's card is checked.
 *
 * @param cell - A `checkbox-card` cell.
 */
export function checkboxCardChecked(cell: Cell): boolean {
  return cell.checked === "true";
}

/**
 * A text the given property sets.
 *
 * @param characters - The text.
 * @param textProperty - The TEXT property that sets it.
 */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/**
 * A part at its place that holds its own text.
 *
 * @param key - The part's key.
 * @param place - The part's place below the card's content.
 * @param characters - The text.
 * @param textProperty - The TEXT property that sets the text.
 */
function textPart(key: string, place: string, characters: string, textProperty: string): PartManifest {
  return {
    key,
    slot: undefined,
    place,
    shownIn: always,
    label: text(characters, textProperty),
    iconsFor: () => [],
  };
}

/** The control's unchecked icon, `Circle`. */
const UNCHECKED: IconManifest = {
  key: "unchecked",
  name: "Unchecked",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Circle",
  swapProperty: undefined,
};

/** The control's checked icon, `CheckCircle` in its `fill` weight. */
const CHECKED: IconManifest = {
  key: "checked",
  name: "Checked",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "CheckCircle",
  weight: "fill",
  swapProperty: undefined,
};

/** The card's text column: a column around the title, then the description. */
const TEXT: PartManifest = {
  key: "text",
  slot: undefined,
  place: "card-content/0/2",
  shownIn: always,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "heading",
      slot: undefined,
      place: "card-content/0/2/0",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [textPart("title", "card-content/0/2/0/0", CHECKBOX_CARD_TITLE, "Title")],
    },
    textPart("description", "card-content/0/2/1", CHECKBOX_CARD_DESCRIPTION, "Description"),
  ],
};

/**
 * The card's manifest, which the capture-backed build reads with `captures/checkbox-card.json`, as
 * the docs default demo's `<CheckboxCard value="insurance">` renders it in a `CheckboxGroup`.
 */
export const CHECKBOX_CARD_MANIFEST: SetManifest = {
  key: "checkbox-card",
  name: "Checkbox card",
  api: { page: "checkbox-card", parts: ["CheckboxCard"] },
  slot: "card",
  axes: [
    { name: "variant", values: ["default", "muted"] },
    { name: "checked", values: ["false", "true"] },
    { name: "state", values: ["rest", "focus", "disabled"] },
  ],
  columnAxis: "state",
  statePlace: "card-content/0/0",
  previewWidth: CHECKBOX_CARD_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "content",
      slot: "card-content",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "label",
          slot: undefined,
          place: "card-content/0",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              key: "control",
              slot: undefined,
              place: "card-content/0/0",
              shownIn: always,
              label: undefined,
              iconsFor: () => [UNCHECKED, CHECKED],
            },
            TEXT,
          ],
        },
      ],
    },
  ],
  swapProperties: [],
};
