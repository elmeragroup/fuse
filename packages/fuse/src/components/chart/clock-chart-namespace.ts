/**
 * Server-visible namespace for `ClockChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each namespace is an ES module namespace over the
 * family's parts module, which a bundler shakes part by part.
 */

/**
 * Clock charts: one cycle of a time series round a calendar dial, a day from midnight, a week from
 * Monday or a year from 1 January at 12 o'clock, every slot an equal angle. A `Line`, an `Area` or a
 * `Column` draws each series, and `Now` points at the current minute.
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
export * as ClockChart from "./clock-chart-parts";
