/**
 * The chart motion tokens. The rAF tween of `chart-motion.ts` moves marks on them, and `chart.css`
 * mirrors the duration and the curve for the opacity fade of a mark that an update adds, so a
 * source contract keeps the two equal. The values follow `.scratch/charts-v1/reviews/motion-decision.md`.
 */
import type { BezierCurve } from "./ease";
import type { Spring } from "./spring";

/** How long a data update moves a mark, in milliseconds. `--chart-update` in `chart.css`. */
export const CHART_UPDATE_MS = 480;

/** The control values of every data update and of the entrance. */
export const CHART_UPDATE_CURVE: BezierCurve = [0, 0.7, 0.5, 1];

/** The same curve as CSS writes it. `--chart-ease` in `chart.css`. */
export const CHART_UPDATE_EASE = `cubic-bezier(${CHART_UPDATE_CURVE.join(", ")})`;

/** The delay between two bars of the entrance wipe, in milliseconds. */
export const CHART_STAGGER_MS = 16;

/** How long a path crossfades into new data that shares no route with the old, in milliseconds. */
export const CHART_CROSSFADE_MS = 150;

/**
 * bklit's springs, mass 1, which `springEasing` samples into CSS `linear()` easings for the glides
 * that follow the pointer: `crosshair` for the line crosshair, `glide` for the tooltip, whose
 * duration is `--chart-glide` in `chart.css`, and `ticker` for Chart.SlotLabel's pill and its
 * rolling parts. Each glide starts from what the mark shows, so a step mid-glide retargets it. The
 * active dots move at once: a dot gliding between two vertices crosses places the tooltip's route,
 * planned over the resting marks, may cover.
 */
export const CHART_SPRINGS = {
  crosshair: { stiffness: 300, damping: 30 },
  glide: { stiffness: 100, damping: 20 },
  ticker: { stiffness: 400, damping: 35 },
} as const satisfies Record<string, Spring>;
