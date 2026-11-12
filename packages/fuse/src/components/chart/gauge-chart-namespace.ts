/**
 * Server-visible namespace for `GaugeChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each namespace is an ES module namespace over the
 * family's parts module, which a bundler shakes part by part.
 */

/**
 * A gauge: one reading on a dial from `min` to `max`, named as a meter, with a notched or solid
 * track, its fill, zones at the rim, a ruler, a needle and the reading in the middle.
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
export * as GaugeChart from "./gauge-chart-parts";
