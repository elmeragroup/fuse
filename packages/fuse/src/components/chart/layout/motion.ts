/**
 * The chart motion tokens. The rAF tween of `chart-motion.ts` moves marks on them, and `chart.css`
 * mirrors the duration and the curve for the opacity fade of a mark that an update adds, so a
 * source contract keeps the two equal. The values follow `.scratch/charts-v1/reviews/motion-decision.md`,
 * whose curve is evilcharts' `REVEAL_EASE`.
 */
import type { BezierCurve } from "./ease";

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
