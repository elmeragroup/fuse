/**
 * Server-visible namespace for `Chart` and its aliases `AreaChart`, `BarChart` and `LineChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each namespace is an ES module namespace over the
 * family's parts module, which a bundler shakes part by part.
 */

/**
 * Cartesian charts. Bars, lines and areas over a category or time axis, with Panels for composed
 * charts that share one x axis, tooltip and crosshair. `Chart.Root` reads every series from
 * `config` and never inspects its children.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * The errors the parts' JSDoc names, such as `unknown-key`, throw as the parts render.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * @beta
 */
export * as Chart from "./chart-parts";

/**
 * `Chart` under the name area-chart readers search for. Every part is the same component.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * The errors the parts' JSDoc names, such as `unknown-key`, throw as the parts render.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * @beta
 */
export * as AreaChart from "./area-chart-parts";

/**
 * `Chart` under the name bar-chart readers search for. Every part is the same component.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * The errors the parts' JSDoc names, such as `unknown-key`, throw as the parts render.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * @beta
 */
export * as BarChart from "./bar-chart-parts";

/**
 * `Chart` under the name line-chart readers search for. Every part is the same component.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * The errors the parts' JSDoc names, such as `unknown-key`, throw as the parts render.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * @beta
 */
export * as LineChart from "./line-chart-parts";
