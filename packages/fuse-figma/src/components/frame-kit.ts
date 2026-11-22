/**
 * Frame, as one component set on the Frame page: the docs default demo's Frame in its default
 * `gutter` layout, one cell.
 *
 * - The root is a `<div data-slot="frame">`. Its sample renders in a 448px host, the width the docs
 *   default demo's `max-w-md` gives it.
 * - The header is a `<header data-slot="frame-panel-header">` around the title and the
 *   description.
 * - Three panels follow, each a `<div data-slot="frame-panel">` holding the demo's text.
 * - The footer is a `<footer data-slot="frame-panel-footer">` holding one `<p>`, as the demo
 *   writes it.
 * - Each text is the docs default demo's, and a TEXT property sets it.
 */
import type { LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/**
 * The layouts the set draws: `gutter`, `Frame.Root`'s default. The set leaves out the `stacked` and
 * `flush` layouts, whose fused panels round one end only, whose lower panel drops its top border, and
 * whose flush items pull over the root's border with a negative margin.
 */
const LAYOUTS = ["gutter"] as const;

/** A Frame's layout, as `Frame.Root` takes its `layout`. */
type FrameLayout = (typeof LAYOUTS)[number];

/**
 * A cell's layout.
 *
 * @param cell - A `frame` cell.
 * @returns The layout its `layout` names.
 * @throws When the cell names no layout the set declares, a defect in the caller's cell.
 */
export function frameLayoutFor(cell: Cell): FrameLayout {
  const layout = LAYOUTS.find((candidate) => candidate === cell.layout);
  if (layout === undefined) {
    throw new Error(`Frame has no layout ${cell.layout ?? ""}`);
  }
  return layout;
}

/** The width the kit's previews and the compare host give a Frame, the docs default demo's `max-w-md`. */
export const FRAME_PREVIEW_WIDTH = 448;

/** The header's title, the default of its `Title` property: the docs default demo's. */
export const FRAME_TITLE_TEXT = "Usage";

/** The header's description, the default of its `Description` property: the docs default demo's. */
export const FRAME_DESCRIPTION_TEXT = "Last three months";

/** The panels' texts, the defaults of their `Panel 1` to `Panel 3` properties: the docs default demo's. */
export const FRAME_PANEL_TEXTS = ["March, 1 240 kWh", "April, 980 kWh", "May, 1 105 kWh"] as const;

/** The footer's paragraph, the default of its `Footer` property: the docs default demo's. */
export const FRAME_FOOTER_TEXT = "Readings arrive every hour.";

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
 * A panel, the root's element after the header at the given index, holding the demo's text.
 *
 * @param index - The panel's index among the panels.
 */
function panelPart(index: number): PartManifest {
  const name = String(index + 1);
  return {
    key: `panel-${name}`,
    slot: undefined,
    place: `frame/${String(index + 1)}`,
    shownIn: always,
    label: text(FRAME_PANEL_TEXTS[index] ?? "", `Panel ${name}`),
    iconsFor: () => [],
  };
}

/**
 * The Frame's manifest, which the capture-backed build reads with `captures/frame.json`: the docs
 * default demo's `Frame.Root` around its header, three panels and footer, in a 448px container.
 */
export const FRAME_MANIFEST: SetManifest = {
  key: "frame",
  name: "Frame",
  api: { page: "frame", parts: ["Frame.Root"] },
  slot: "frame",
  axes: [{ name: "layout", values: LAYOUTS }],
  columnAxis: "layout",
  previewWidth: FRAME_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: "frame-panel-header",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "title",
          slot: "frame-panel-title",
          shownIn: always,
          label: text(FRAME_TITLE_TEXT, "Title"),
          iconsFor: () => [],
        },
        {
          key: "description",
          slot: "frame-panel-description",
          shownIn: always,
          label: text(FRAME_DESCRIPTION_TEXT, "Description"),
          iconsFor: () => [],
        },
      ],
    },
    ...FRAME_PANEL_TEXTS.map((_, index) => panelPart(index)),
    {
      key: "footer",
      slot: "frame-panel-footer",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "paragraph",
          slot: undefined,
          place: "frame-panel-footer/0",
          shownIn: always,
          label: text(FRAME_FOOTER_TEXT, "Footer"),
          iconsFor: () => [],
        },
      ],
    },
  ],
  swapProperties: [],
};
