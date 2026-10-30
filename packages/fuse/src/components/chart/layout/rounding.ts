/**
 * The rounding a server-drawn path goes through. A Sparkline's path keeps 3 digits, as d3-shape's
 * generators round by default. A chart's own
 * paths keep every digit, because each coordinate lies on the device pixel grid already. Either
 * way React renders a path's resting `d` through the same builder the loop's last frame calls, so
 * the two write the same string.
 */

/** The digits a path coordinate keeps, d3-shape's default. */
export const PATH_DIGITS = 3;

/** Round to a number of digits, and turn -0 into 0, which no attribute may carry. */
function rounded(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale + 0;
}

/**
 * A path coordinate as SVG path data writes it.
 *
 * @param value - The coordinate.
 * @param digits - The digits it keeps, `PATH_DIGITS` by default.
 * @returns The rounded coordinate.
 */
export function pathNumber(value: number, digits: number = PATH_DIGITS): string {
  return String(rounded(value, digits));
}
