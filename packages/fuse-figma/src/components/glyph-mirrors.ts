/**
 * The glyphs the kit can swap for another glyph turned half a turn. Figma refuses a turn on a layer
 * inside an instance (PT), so where a composite turns an inner glyph half a turn, as Combobox's caret
 * turns while its popup is open, the instance swaps to the glyph that draws that shape unturned. Each
 * pair is proven from the icon library in `glyph-mirrors.test.ts`: the mirror's shape is the glyph's
 * shape turned 180° about the centre of its box.
 */
import { iconKey } from "./kit-spec";

/** Each glyph's half-turn mirror, by icon key. */
export const HALF_TURN_MIRRORS: ReadonlyMap<string, string> = new Map([
  [iconKey("CaretDown"), iconKey("CaretUp")],
]);
