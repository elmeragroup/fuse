/**
 * Package-private: a density metric's computed value in px. `fuse.css` declares the metrics as
 * unregistered custom properties, so the browser reports one as written, a `rem` or `px`
 * length such as `2rem`, and a virtualizer needs pixels.
 *
 * @param value - The custom property's computed value, such as `" 2rem"`.
 * @param rootFontSize - The root element's font size in px, which one `rem` equals.
 * @returns The length in px, or `undefined` when the value is not a single `rem` or `px` length.
 */
export function densityLengthInPx(value: string, rootFontSize: number): number | undefined {
  const match = /^(\d+(?:\.\d+)?|\.\d+)(rem|px)$/u.exec(value.trim());
  if (match === null) {
    return undefined;
  }
  const amount = Number(match[1]);
  return match[2] === "rem" ? amount * rootFontSize : amount;
}
