/**
 * Server-visible namespace for `ScatterChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each namespace is an ES module namespace over the
 * family's parts module, which a bundler shakes part by part.
 */

/**
 * Scatter charts over a numeric x and a numeric y, from long rows with a series column. `Points`
 * draws a series as dots and `Line` joins a series' points in x order, so the same compound draws
 * curves over a numeric x, such as a fitted normal line or a charging curve. Up to 100 000 points
 * draw as one SVG path per series.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * @beta
 */
export * as ScatterChart from "./scatter-chart-parts";
