/**
 * Field's text parts beside Label, as four component sets on the Field page: the description, the
 * error, the legend and the title.
 *
 * - The description is Base UI's `<p data-slot="field-description">` and the error its
 *   `<div data-slot="field-error">`, each in a `Field.Root`. The legend is Base UI's `<div
 *   data-slot="field-legend">` in a `Field.Set`. Each renders in a 384px host, the width the Field
 *   gives Input and Textarea, and wraps its text there.
 * - The title is a `<div data-slot="field-title">` in a `Field.Root`, which hugs its text, so its
 *   host gives it no width. Its disabled cell renders it in a disabled Field.
 * - Each text is a docs demo's copy, which a `Text` property sets.
 * - The description draws the same in every state of its Field, so its set has one `state`, `rest`.
 *   The error shows in an invalid Field, so its one `state` is `invalid`. The legend has a cell for
 *   each `variant`.
 */
import type { LabelManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import type { AxisSpec } from "./kit-spec";

/** The description's text, the default of its `Text` property: the docs Basic demo's description. */
export const FIELD_DESCRIPTION_TEXT = "Work address preferred.";

/** The error's text, the default of its `Text` property: the docs Error message demo's error. */
export const FIELD_ERROR_TEXT = "Enter a work email.";

/** The legend's text, the default of its `Text` property: the docs Field set demo's legend. */
export const FIELD_LEGEND_TEXT = "Notifications";

/** The title's text, the default of its `Text` property: the docs Choice card demo's title. */
export const FIELD_TITLE_TEXT = "Fixed price";

/** The legend's variants, as `Field.Legend` takes its `variant`, its default first. */
const LEGEND_VARIANTS = ["legend", "label"] as const;

/** A legend variant, as `Field.Legend` takes it. */
type LegendVariant = (typeof LEGEND_VARIANTS)[number];

/**
 * A cell's legend variant.
 *
 * @param cell - A `field-legend` cell.
 * @returns The variant its `variant` names.
 * @throws When the cell names no variant the set declares, a defect in the caller's cell.
 */
export function legendVariantFor(cell: Cell): LegendVariant {
  const variant = LEGEND_VARIANTS.find((candidate) => candidate === cell.variant);
  if (variant === undefined) {
    throw new Error(`Field legend has no variant ${cell.variant ?? ""}`);
  }
  return variant;
}

/** The text a part shows in every cell, which its `Text` property sets. */
function text(characters: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty: "Text", shownIn: () => true };
}

/**
 * A text part's manifest, whose key is also its root's `data-slot`.
 *
 * @param key - The set's key and its root's `data-slot`.
 * @param name - The set's name.
 * @param axis - The set's one axis, which is also its column axis.
 * @param characters - The text every cell shows.
 * @param previewWidth - The width of the host the sample renders in, or undefined for a part that
 *   hugs its text.
 * @returns The manifest.
 */
function textManifest(
  key: string,
  name: string,
  axis: AxisSpec,
  characters: string,
  previewWidth: number | undefined
): SetManifest {
  const manifest: SetManifest = {
    key,
    name,
    slot: key,
    axes: [axis],
    columnAxis: axis.name,
    label: text(characters),
    iconsFor: () => [],
    swapProperties: [],
  };
  return previewWidth === undefined ? manifest : { ...manifest, previewWidth };
}

/**
 * The description's manifest, which the capture-backed build reads with
 * `captures/field-description.json`, as `<Field.Root><Field.Description>…</Field.Description></Field.Root>`
 * renders it.
 */
export const FIELD_DESCRIPTION_MANIFEST: SetManifest = textManifest(
  "field-description",
  "Field description",
  { name: "state", values: ["rest"] },
  FIELD_DESCRIPTION_TEXT,
  FIELD_BOX_PREVIEW_WIDTH
);

/**
 * The error's manifest, which the capture-backed build reads with `captures/field-error.json`, as
 * `<Field.Root invalid><Field.Error>…</Field.Error></Field.Root>` renders it.
 */
export const FIELD_ERROR_MANIFEST: SetManifest = textManifest(
  "field-error",
  "Field error",
  { name: "state", values: ["invalid"] },
  FIELD_ERROR_TEXT,
  FIELD_BOX_PREVIEW_WIDTH
);

/**
 * The legend's manifest, which the capture-backed build reads with `captures/field-legend.json`, as
 * `<Field.Set><Field.Legend variant>…</Field.Legend></Field.Set>` renders it.
 */
export const FIELD_LEGEND_MANIFEST: SetManifest = textManifest(
  "field-legend",
  "Field legend",
  { name: "variant", values: LEGEND_VARIANTS },
  FIELD_LEGEND_TEXT,
  FIELD_BOX_PREVIEW_WIDTH
);

/**
 * The title's manifest, which the capture-backed build reads with `captures/field-title.json`, as
 * `<Field.Root disabled={…}><Field.Title>…</Field.Title></Field.Root>` renders it.
 */
export const FIELD_TITLE_MANIFEST: SetManifest = textManifest(
  "field-title",
  "Field title",
  { name: "state", values: ["rest", "disabled"] },
  FIELD_TITLE_TEXT,
  undefined
);
