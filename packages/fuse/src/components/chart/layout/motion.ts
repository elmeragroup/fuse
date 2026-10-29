/**
 * The chart motion tokens. `chart.css` mirrors each one as a custom property on Root, and a source
 * contract keeps the two equal, so the CSS bar transitions and the JS path tween of later layers
 * move on one curve. The values follow `.scratch/charts-v1/reviews/motion-decision.md`, whose curve
 * is evilcharts' `REVEAL_EASE`.
 */

/** How long a data update moves a mark, in milliseconds. `--chart-update` in `chart.css`. */
export const CHART_UPDATE_MS = 480;

/** The easing of every data update and of the entrance. `--chart-ease` in `chart.css`. */
export const CHART_UPDATE_EASE = "cubic-bezier(0, 0.7, 0.5, 1)";

/** The delay between two bars of the entrance wipe, in milliseconds. `--chart-stagger` in `chart.css`. */
export const CHART_STAGGER_MS = 16;
