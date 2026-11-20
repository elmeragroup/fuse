/**
 * The samples `figma:capture` renders for the text styles, one per recipe combination. Text and Span
 * render each size and weight of Text's recipe axes, which Span shares. Heading renders each themed
 * level with no `size` or `font`, then each `size` and `font` at level 2. That makes 66 samples,
 * which collapse to 54 styles, since Text's and Span's `bold` draw the same type as `medium`. The
 * capture, the renderer and the build read the samples from this table, so the three agree on the
 * cells.
 */
import { headingVariants, textVariants, THEMED_HEADING_LEVELS } from "@elmeragroup/fuse/recipe-catalog";

import type { CaptureTarget } from "../capture/run-capture";
import type { Cell } from "./component-spec";
import { ownKey } from "./own-key";

/** The keys of a recipe axis that are its own, in the recipe's order. */
function axisKeys<Table extends object>(table: Table): Extract<keyof Table, string>[] {
  return Object.keys(table).filter((key) => ownKey(table, key));
}

/** A Text or Span size, as its recipe names it. */
type BodySize = Extract<keyof typeof textVariants.variants.size, string>;

/** A Text or Span weight, as its recipe names it. */
type BodyWeight = Extract<keyof typeof textVariants.variants.weight, string>;

/** A Heading size, as its recipe names it. */
type HeadingSize = Extract<keyof typeof headingVariants.variants.size, string>;

/** A Heading font, as its recipe names it. */
type HeadingFont = Extract<keyof typeof headingVariants.variants.font, string>;

/** The props a sample renders its component with. */
type SampleProps =
  | { readonly component: "Text" | "Span"; readonly size: BodySize; readonly weight: BodyWeight }
  | { readonly component: "Heading"; readonly level: (typeof THEMED_HEADING_LEVELS)[number] }
  | {
      readonly component: "Heading";
      readonly level: 2;
      readonly size: HeadingSize;
      readonly font: HeadingFont;
    };

/** One rendered sample and the text style it stands for. */
export type TextStyleSample = {
  /** The sample's value on the `sample` axis, which names its cell in the capture. */
  readonly value: string;
  /** The `data-slot` the component renders on its root. */
  readonly slot: "text" | "span" | "heading";
  /**
   * The style name's segments, such as `["Text", "sm"]`. A literal weight's segment follows them,
   * and a themed Heading level, whose weight binds a variable, has none.
   */
  readonly path: readonly string[];
  readonly description: string;
  readonly props: SampleProps;
};

/** The name of a recipe size in a style name: `default` draws the `base` step. */
function sizeName(size: string): string {
  return size === "default" ? "base" : size;
}

/** The Text or Span samples, one per size and weight, in recipe order. */
function bodySamples(component: "Text" | "Span"): TextStyleSample[] {
  const slot = component === "Text" ? "text" : "span";
  return axisKeys(textVariants.variants.size).flatMap((size) =>
    axisKeys(textVariants.variants.weight).map((weight): TextStyleSample => ({
      value: `${slot}/${size}/${weight}`,
      slot,
      path: [component, sizeName(size)],
      description: `${component} with the size ${size} and the weight ${weight}.`,
      props: { component, size, weight },
    }))
  );
}

/** The Heading samples: its themed levels, then each size and font at level 2. */
function headingSamples(): TextStyleSample[] {
  const levels = THEMED_HEADING_LEVELS.map((level): TextStyleSample => ({
    value: `heading/${String(level)}`,
    slot: "heading",
    path: ["Heading", String(level)],
    description: `Heading at level ${String(level)}, whose size, line height and weight follow the theme.`,
    props: { component: "Heading", level },
  }));
  // A Heading with both `size` and `font` set reads no theme role at any level.
  const sizes = axisKeys(headingVariants.variants.size).flatMap((size) =>
    axisKeys(headingVariants.variants.font).map((font): TextStyleSample => ({
      value: `heading/${size}/${font}`,
      slot: "heading",
      path: ["Heading", sizeName(size)],
      description: `Heading with the size ${size} and the font ${font}.`,
      props: { component: "Heading", level: 2, size, font },
    }))
  );
  return [...levels, ...sizes];
}

/** Every sample: Heading's, then Text's, then Span's. */
export const TEXT_STYLE_SAMPLES: readonly TextStyleSample[] = [
  ...headingSamples(),
  ...bodySamples("Text"),
  ...bodySamples("Span"),
];

const SAMPLES_BY_VALUE = new Map(TEXT_STYLE_SAMPLES.map((sample) => [sample.value, sample]));

/** The axis whose values name the samples. */
const SAMPLE_AXIS = "sample";

/**
 * The sample a cell renders.
 *
 * @param cell - A cell of {@link TEXT_STYLE_CAPTURE}.
 * @returns The sample.
 * @throws When the cell's `sample` names no sample, a defect of the caller, since the capture and the
 *   build make every cell from this table.
 */
export function sampleOf(cell: Cell): TextStyleSample {
  const sample = SAMPLES_BY_VALUE.get(cell[SAMPLE_AXIS] ?? "");
  if (sample === undefined) {
    throw new Error(`no text style sample renders the cell ${JSON.stringify(cell)}`);
  }
  return sample;
}

/** The cell that renders a sample. */
export function sampleCell(sample: TextStyleSample): Cell {
  return { [SAMPLE_AXIS]: sample.value };
}

/** The text every sample holds. The style takes the sample's type and none of its text. */
export const SAMPLE_TEXT = "Ag";

/**
 * The samples as one capture, which `figma:capture` writes to `captures/text-styles.json`. Each
 * cell's root carries the `data-slot` of its sample's component.
 */
export const TEXT_STYLE_CAPTURE: CaptureTarget = {
  key: "text-styles",
  slot: "text",
  elementSlot: (cell) => sampleOf(cell).slot,
  axes: [{ name: SAMPLE_AXIS, values: TEXT_STYLE_SAMPLES.map(({ value }) => value) }],
};
