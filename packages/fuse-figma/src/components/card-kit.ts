/**
 * Card, as one component set on the Card page: the docs default demo's vertical card at its two
 * sizes, 2 cells, with columns by `size`.
 *
 * - The root is a `<div data-slot="card">`. Its sample renders in a 448px host, the width the docs
 *   default demo's `max-w-md` gives it.
 * - The header is a `<div data-slot="card-header">`, a grid in one column around the title, an
 *   `<h3>`, and the description, a `<p>`.
 * - The content and the footer each hold one `<p>`, as the demo writes them.
 * - Each text is the docs default demo's, and a TEXT property sets it: `Title`, `Description`,
 *   `Content` and `Footer`.
 *
 * The set draws no `Card.Action`, `Card.Tag`, `Card.Section` or `Card.SectionButton`.
 *
 * It draws no `direction="horizontal"` card either, a known limit (#922). That card's header,
 * content and footer share a wrapping row as `flex: 2 1 16rem`, `1 1 12rem` and `1 1 8rem`, gapped
 * by the card's tier. At the set's 448px width the row wraps in every mode, and it holds one line in
 * every mode only from 674px. On that line each part takes its basis and its weight's share of the
 * free space, so at every width the header is twice as wide as the footer and the content is 64px
 * wider than the footer. A Figma row gives the layers that fill it equal widths, and a grid shares
 * its room among FLEX tracks by their shares with no basis (PG12), so neither keeps the 64px. A grid
 * could keep it only with the content spanning a 64px track and a FLEX track, and the tier in
 * spacer tracks between the parts. The build draws no grid from a flex row and no spanning layer,
 * and no probe has drawn a span. Literal widths would hold at one card width in one mode only: at
 * 768px the default card's header is 327px dense and 319px comfortable, and the lg card's 319px and
 * 303px.
 */
import type { LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The width the kit's previews and the compare host give a Card, the docs default demo's `max-w-md`. */
export const CARD_PREVIEW_WIDTH = 448;

/** The title's text, the default of its `Title` property: the docs default demo's. */
export const CARD_TITLE_TEXT = "March usage";

/** The description's text, the default of its `Description` property: the docs default demo's. */
export const CARD_DESCRIPTION_TEXT = "Estimated consumption for the period.";

/** The content's paragraph, the default of its `Content` property: the docs default demo's. */
export const CARD_CONTENT_TEXT = "1 240 kWh across two meters.";

/** The footer's paragraph, the default of its `Footer` property: the docs default demo's. */
export const CARD_FOOTER_TEXT = "Settled on 3 April.";

/** The sizes `Card.Root` takes, its default first. */
const SIZES = ["default", "lg"] as const;

/** A size of the card, as `Card.Root` takes its `size`. */
type CardSize = (typeof SIZES)[number];

/**
 * A cell's size.
 *
 * @param cell - A `card` cell.
 * @returns The size its `size` names.
 * @throws When the cell names no size the set declares, a defect in the caller's cell.
 */
export function cardSizeFor(cell: Cell): CardSize {
  const size = SIZES.find((candidate) => candidate === cell.size);
  if (size === undefined) {
    throw new Error(`Card has no size ${cell.size ?? ""}`);
  }
  return size;
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
 * A part that holds one paragraph, as the docs default demo writes the content and the footer.
 *
 * @param key - The part's key.
 * @param slot - The part's `data-slot`.
 * @param characters - The paragraph's text.
 * @param textProperty - The TEXT property that sets the text.
 */
function paragraphPart(key: string, slot: string, characters: string, textProperty: string): PartManifest {
  return {
    key,
    slot,
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        key: "paragraph",
        slot: undefined,
        place: `${slot}/0`,
        shownIn: always,
        label: text(characters, textProperty),
        iconsFor: () => [],
      },
    ],
  };
}

/**
 * The card's manifest, which the capture-backed build reads with `captures/card.json`: the docs
 * default demo's card, as `<Card.Root size>` around its header, content and footer, in a 448px
 * container.
 */
export const CARD_MANIFEST: SetManifest = {
  key: "card",
  name: "Card",
  api: { page: "card", parts: ["Card.Root"] },
  slot: "card",
  axes: [{ name: "size", values: SIZES }],
  columnAxis: "size",
  previewWidth: CARD_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: "card-header",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "title",
          slot: "card-title",
          shownIn: always,
          label: text(CARD_TITLE_TEXT, "Title"),
          iconsFor: () => [],
        },
        {
          key: "description",
          slot: "card-description",
          shownIn: always,
          label: text(CARD_DESCRIPTION_TEXT, "Description"),
          iconsFor: () => [],
        },
      ],
    },
    paragraphPart("content", "card-content", CARD_CONTENT_TEXT, "Content"),
    paragraphPart("footer", "card-footer", CARD_FOOTER_TEXT, "Footer"),
  ],
  swapProperties: [],
};
