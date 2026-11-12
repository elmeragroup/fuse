/**
 * Server-visible namespace for `LiveLineChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each namespace is an ES module namespace over the
 * family's parts module, which a bundler shakes part by part.
 */

/**
 * Live line charts: one value over a time window that scrolls with the clock, its right edge always
 * now, as the consumer's feed of readings arrives. The window moves every frame, a new reading
 * grows out of the last one, the value axis eases to fit, and a live dot and a badge mark the latest
 * value. Its x axis is continuous time, not `Chart`'s slots, so it is a family of its own, as
 * `ScatterChart` is for a numeric x.
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
export * as LiveLineChart from "./live-line-chart-parts";
