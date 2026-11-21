/**
 * The renderer of the text style samples. Each cell renders the real Fuse `Text`, `Span` or
 * `Heading` with the props its sample names, around the sample text. The page measures the
 * component's root, the one element with that component's `data-slot`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Heading } from "../../../fuse/dist/heading.js";
import { Span } from "../../../fuse/dist/span.js";
import { Text } from "../../../fuse/dist/text.js";
import type { Cell } from "../components/component-spec.ts";
import { SAMPLE_TEXT, sampleOf } from "../components/text-style-samples.ts";
import type { TextStyleSample } from "../components/text-style-samples.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The component a sample names, with the sample's props, around the sample text. */
function sampleElement(props: TextStyleSample["props"]): ReactElement {
  switch (props.component) {
    case "Text":
      return createElement(Text, { size: props.size, weight: props.weight }, SAMPLE_TEXT);
    case "Span":
      return createElement(Span, { size: props.size, weight: props.weight }, SAMPLE_TEXT);
    case "Heading":
      return "size" in props
        ? createElement(Heading, { level: props.level, size: props.size, font: props.font }, SAMPLE_TEXT)
        : createElement(Heading, { level: props.level }, SAMPLE_TEXT);
  }
}

/** Renders each text style cell as the component its sample names. */
export const textStyles: CellRendering = {
  element: (cell: Cell) => sampleElement(sampleOf(cell).props),
};
