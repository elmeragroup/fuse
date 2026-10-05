import type { ReactElement } from "react";

import type { SpecimenContext } from "../specimen-kit";

/**
 * One component's specimen: the scale it reads best at and the drawing itself. Most controls
 * draw at 2×, where `text-xs` lands on the 24px floor; small controls such as Switch draw larger.
 */
export type Specimen = {
  /** Image pixels per CSS pixel. Keep `text-xs` (12px) at or above 24px, so 2 or more. */
  readonly scale: number;
  /** The variant and state the drawing shows, as the frame's caption: `variant="outline"`. */
  readonly caption: string;
  /** Draws the specimen in the context's theme. */
  readonly draw: (ctx: SpecimenContext) => ReactElement;
};
