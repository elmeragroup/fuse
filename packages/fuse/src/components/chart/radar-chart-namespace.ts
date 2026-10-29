/**
 * Server-visible namespace for `RadarChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each namespace is an ES module namespace over the
 * family's parts module, which a bundler shakes part by part.
 */

/**
 * Radar charts, at most 4 series over one spoke per row. A filled radar is `Area` plus `Line`, and
 * an outline radar is `Line` alone.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * The errors the parts' JSDoc names, such as `unknown-key`, start to throw once the parts render in
 * a later preview release.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * @beta
 */
export * as RadarChart from "./radar-chart-parts";
