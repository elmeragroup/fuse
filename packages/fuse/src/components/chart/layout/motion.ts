/**
 * The chart motion tokens. The rAF tween of `chart-motion.ts` moves marks on them, and `chart.css`
 * mirrors the duration and the curve for the opacity fade of a mark that an update adds, so a
 * change here changes `--chart-update` and `--chart-ease` there too. The values follow `.scratch/charts-v1/reviews/motion-decision.md`.
 */
import type { BezierCurve } from "./ease";
import type { Spring } from "./spring";

/** How long a data update moves a mark, in milliseconds. `--chart-update` in `chart.css`. */
export const CHART_UPDATE_MS = 480;

/** The control values of every data update and of the entrance. */
export const CHART_UPDATE_CURVE: BezierCurve = [0, 0.7, 0.5, 1];

/** The delay between two bars of the entrance wipe, in milliseconds. */
export const CHART_STAGGER_MS = 16;

/** How long a path crossfades into new data that shares no route with the old, in milliseconds. */
export const CHART_CROSSFADE_MS = 150;

/**
 * The chart's springs, mass 1, which `springEasing` samples into CSS `linear()` easings for the
 * glides that follow the pointer. `follow` is the tooltip dot's spring, which the line crosshair
 * and the active dots share on each step: a slow pointer takes it as it is, a faster pointer
 * stiffens it, `FOLLOW_FASTEST` at most, and a keyboard step takes `FOLLOW_FASTEST`. `glide` moves the tooltip, whose duration is
 * `--chart-glide` in `chart.css`, and keeps its softer spring at every speed. `ticker` moves
 * Chart.SlotLabel's pill and its rolling parts and a pie's centre digits. `pop` moves the active
 * slice out along its bisector and scales the active ring. `grow` scales a ring's track or a
 * radar's ring out as the entrance starts, and `extend` grows a radar's spokes. A polar Root's hand
 * and dots turn on the follow springs too, through its angle follower. Each glide starts from what the mark shows, so a step
 * mid-glide retargets it.
 */
export const CHART_SPRINGS = {
  follow: { stiffness: 300, damping: 30 },
  glide: { stiffness: 100, damping: 20 },
  ticker: { stiffness: 400, damping: 35 },
  pop: { stiffness: 400, damping: 25 },
  grow: { stiffness: 100, damping: 15 },
  extend: { stiffness: 80, damping: 15 },
} as const satisfies Record<string, Spring>;

/**
 * The stiffest spring a fast pointer gives the crosshair and the active dots. At `follow`'s damping
 * ratio, 30 / (2√300) ≈ 0.87, it settles within 0.1% in about 120 ms, against `follow`'s 506 ms,
 * and overshoots no more than `follow` does.
 */
export const FOLLOW_FASTEST = 5300;

/**
 * The pointer speeds, in CSS pixels per millisecond, between which the follow spring stiffens: at
 * the slower one or below it is `follow` itself, and at the faster one or above it is
 * `FOLLOW_FASTEST`. Between them its natural frequency, the square root of its stiffness, grows in
 * step with the speed, so its settling time shrinks smoothly. A slow scrub crosses a 600 px plot in
 * about two seconds, and a flick in a fifth of one.
 */
export const FOLLOW_SPEEDS = { slow: 0.3, fast: 3 } as const;

/**
 * How many springs the speeds map onto, `follow` and `FOLLOW_FASTEST` included. Each one is sampled
 * into its easing once per page, and a step takes the one nearest its speed.
 */
export const FOLLOW_LEVELS = 6;
