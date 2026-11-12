/**
 * A gauge's frame: the one value its Root's loop moves, and the painters that draw from it. Root
 * places a single mark on its loop, the reading's share of the domain from 0 to 1, and the mark's
 * writer is the frame's `draw`, so in every frame the fill, the notches, the ruler's ticks, the
 * needle and the glow read the same number and never drift apart. Each painter turns the share into
 * an angle on the sweep it draws now, so a sweep that changes is geometry: every painter registers
 * again with the new sweep and paints the share the loop drew last at once, together. The frame also holds what Root measured, CSS pixels per unit
 * of the track's radius and the device pixel ratio, which the notches and a solid fill snap to.
 */
import type { MarkValues } from "./chart-motion";
import { NOMINAL_PIXELS } from "./layout/gauge";
import type { DialPixels } from "./layout/gauge";

/** One part's drawing on the frame. */
export type GaugePainter = {
  /** Draw the share of the domain the loop shows this frame, from 0 at `min` to 1 at `max`. */
  readonly paint: (share: number) => void;
  /** Lay the part out again for a new measurement, before it paints. */
  readonly layout?: (pixels: DialPixels) => void;
};

/** A gauge's frame. */
export type GaugeFrame = {
  /** The loop's writer: draw every painter at the share this frame shows. */
  readonly draw: (values: MarkValues) => void;
  /**
   * Add a painter, which lays out and paints at once.
   *
   * @returns The painter's removal.
   */
  readonly register: (painter: GaugePainter) => () => void;
  /** Take a new measurement, and lay out and paint every painter again when it changed. */
  readonly measure: (pixels: DialPixels) => void;
};

/**
 * Create a gauge's frame.
 *
 * @returns The frame.
 */
export function createGaugeFrame(): GaugeFrame {
  const painters = new Set<GaugePainter>();
  let shown: number | null = null;
  let pixels = NOMINAL_PIXELS;
  return {
    draw: (values) => {
      shown = values[0] ?? 0;
      for (const painter of painters) painter.paint(shown);
    },
    register: (painter) => {
      painters.add(painter);
      painter.layout?.(pixels);
      if (shown !== null) painter.paint(shown);
      return () => {
        painters.delete(painter);
      };
    },
    measure: (next) => {
      if (next.scale === pixels.scale && next.dpr === pixels.dpr) return;
      pixels = next;
      for (const painter of painters) {
        painter.layout?.(pixels);
        if (shown !== null) painter.paint(shown);
      }
    },
  };
}
