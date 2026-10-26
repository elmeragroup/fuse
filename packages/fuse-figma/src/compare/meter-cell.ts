/**
 * The renderer of the `meter` set: each cell as the real Fuse `<Meter>` at the docs Modes demo's
 * value for its level, as `meter-kit.ts` draws it.
 *
 * - Meter reads the locale from `LocaleProvider`, which throws without one, so the cell renders in
 *   `en-US`, the locale the docs set.
 * - The meter sits in a host as wide as the kit's preview width, which the block-level root fills.
 *   The compare page's slot has no width of its own.
 * - `valueLabel` holds the cell's text, so the value is plain text after the icon, where
 *   `Meter.Value` would wrap it in a span of its own.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Meter } from "../../../fuse/dist/meter.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import {
  METER_LABEL,
  METER_PREVIEW_WIDTH,
  modeFor,
  sampleFor,
  valueTextFor,
} from "../components/meter-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `meter` cell: a meter of one mode at one level's value. */
export const meter: CellRendering = {
  element: (cell: Cell) => {
    const { value, max } = sampleFor(cell);
    const host = createElement(
      "div",
      { style: { width: `${METER_PREVIEW_WIDTH}px` } },
      createElement(Meter, {
        label: METER_LABEL,
        mode: modeFor(cell),
        value,
        maxValue: max,
        valueLabel: valueTextFor(cell),
      })
    );
    return createElement(LocaleProvider, { locale: "en-US", children: host });
  },
};
