/**
 * Caret bookkeeping for a display the field rewrites, as `formatOnType` does. A position is
 * kept as the number of digits (and `+`) after it: separators change, and a display can gain
 * or lose a prefix, such as the calling code an international display adds in front of the
 * first typed digit, but what follows the caret keeps its digits. Offsets are UTF-16 indices,
 * as `setSelectionRange` takes them.
 */

const SIGNIFICANT_REGEX = /[\d+]/;

/** Which side of the separators between two digits a caret takes. */
export type CaretSide =
  /** Right after the digit before it, as after typing or Backspace. */
  | "afterPrevious"
  /** Right before the digit after it, so a forward Delete reaches that digit. */
  | "beforeNext";

function significantOffsets(text: string): number[] {
  const offsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (SIGNIFICANT_REGEX.test(text.charAt(index))) offsets.push(index);
  }
  return offsets;
}

/** How many digits and `+` signs follow `offset` in `text`. */
export function significantAfter(text: string, offset: number): number {
  return significantOffsets(text).filter((index) => index >= offset).length;
}

/** The offset in `text` with `after` digits or `+` signs after it, on the given side. */
export function caretOffset(text: string, after: number, side: CaretSide): number {
  const offsets = significantOffsets(text);
  const before = offsets.length - after;
  if (side === "beforeNext") {
    return offsets[Math.max(0, before)] ?? text.length;
  }
  const previous = before > 0 ? offsets[Math.min(before, offsets.length) - 1] : undefined;
  return previous === undefined ? 0 : previous + 1;
}
