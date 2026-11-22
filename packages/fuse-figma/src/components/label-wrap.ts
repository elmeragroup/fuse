/**
 * Whether a label's text wraps: the wrapping longhands, a text with no soft wrap opportunity that a
 * browser never wraps, and the line clamp a box ends its wrapping label at. `box-mapping.ts` reads
 * the line clamp here, and `label-sizing.ts` and `instance-parts.ts` read the wrap rules.
 */

import type { Holder } from "./box-sizing";
import type { LabelDefinition } from "./component-spec";
import { evaluateNumber, normalizeCss } from "./css-values";
import type { LayerStyle } from "./layer-style";

/**
 * Whether the wrapping longhands let a text wrap: `text-wrap-mode` unset or `wrap`, which `white-space`
 * and `text-wrap` both set, so the cascade's winner decides.
 */
export function wraps(mode: string): boolean {
  return mode === "" || mode === "wrap";
}

/**
 * Decide whether a box clamps its label, as `line-clamp-*` makes it: a vertical `-webkit-box` that
 * hides its overflow and holds only its label, whose text wraps, at a `-webkit-line-clamp` of a
 * whole number of lines.
 *
 * @param holder - The box.
 * @param label - The label the box shows in the cell, or undefined for none.
 * @returns The lines the box clamps its label to, or undefined where it draws no clamp, which leaves
 *   the box's `-webkit-box` and every clamp declaration unmapped. The box's display and its label
 *   both read this one decision.
 */
export function readLineClamp(holder: Holder, label: LabelDefinition | undefined): number | undefined {
  const value = (property: string): string => normalizeCss(holder.style.resolved(property) ?? "");
  const holds =
    value("display") === "-webkit-box" &&
    label !== undefined &&
    holder.layers.length === 1 &&
    value("-webkit-box-orient") === "vertical" &&
    value("overflow") === "hidden" &&
    ["", "collapse"].includes(value("white-space-collapse")) &&
    wraps(value("text-wrap-mode"));
  return holds ? lineCount(value("-webkit-line-clamp")) : undefined;
}

/**
 * Why a box's line clamp sets nothing where its display is not `-webkit-box`: `-webkit-line-clamp`
 * and `-webkit-box-orient` take effect only in a `-webkit-box` (CSS Overflow 4 §4.2), so a later
 * `display: flex` over a `line-clamp-*` leaves both inert, as Select's trigger leaves its value.
 *
 * @param style - The box's style.
 * @returns The reason, or undefined for a `-webkit-box`, which the clamp can take effect in.
 */
export function inertClamp(style: LayerStyle): string | undefined {
  const display = normalizeCss(style.resolved("display") ?? "");
  return display === "-webkit-box"
    ? undefined
    : `the box's display is ${display === "" ? "unset" : display}, and a line clamp takes effect only in a -webkit-box`;
}

/**
 * ASCII letters and digits alone, which line breaking keeps together (UAX #14 classes AL and NU), so
 * such a text holds no soft wrap opportunity, as Avatar's initials hold none. Script is no guide:
 * fullwidth letters such as `ＡＬ` are Latin and take class ID, which breaks between them. A space,
 * a hyphen and every other character count as breakable, the safe answer.
 */
const UNBREAKABLE = /^[A-Za-z0-9]+$/;

/**
 * The properties that can break a text inside a word (CSS Text 3 §5.1 to §5.4), each with the values
 * that add no break inside a word of letters and digits: `word-break: keep-all` forbids one, a
 * strictness other than `anywhere` changes only where punctuation and CJK text break, and
 * `hyphens: manual` breaks only at a soft hyphen, which such a word lacks. The build reads none of
 * them, so a class that sets one lands unmapped wherever it sits.
 */
const WORD_BREAKING: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["word-break", new Set(["normal", "keep-all"])],
  ["line-break", new Set(["auto", "loose", "normal", "strict"])],
  ["hyphens", new Set(["none", "manual"])],
  ["overflow-wrap", new Set(["normal"])],
]);

/**
 * The CSS-wide keywords the cascade leaves as they are on a property of {@link WORD_BREAKING}: an
 * `initial`, and an `inherit` or `unset` with nothing outside to take a value from, which takes the
 * initial value. Each property's initial value adds no break. A keyword a `var()` fallback leaves
 * counts as breaking instead, since the build does not resolve it against the parent.
 */
const INITIAL_KEYWORDS: ReadonlySet<string> = new Set(["initial", "inherit", "unset"]);

/**
 * Whether a browser never wraps a text: it holds no soft wrap opportunity, and the box sets or
 * inherits nothing that breaks inside a word. Such a text sets one line at its own width whatever
 * room the box gives it. One character has no other to break from, so it never wraps. A value that
 * does not resolve counts as breaking, the safe answer.
 *
 * @param style - The style of the box that holds the text.
 * @param characters - The text.
 * @returns True where the text never wraps.
 */
export function neverWraps(style: LayerStyle, characters: string): boolean {
  if (!UNBREAKABLE.test(characters)) {
    return false;
  }
  return (
    characters.length === 1 ||
    [...WORD_BREAKING].every(([property, keeps]) => {
      const value = style.resolved(property);
      if (value === undefined) {
        return !style.has(property);
      }
      const keyword = normalizeCss(value).toLowerCase();
      const bare = normalizeCss(style.written(property) ?? "").toLowerCase() === keyword;
      return INITIAL_KEYWORDS.has(keyword) ? bare : keeps.has(keyword);
    })
  );
}

/** The lines `-webkit-line-clamp` keeps: a whole number of at least 1, or undefined for any other value. */
function lineCount(value: string): number | undefined {
  const count = evaluateNumber(value);
  return count !== undefined && Number.isInteger(count) && count >= 1 ? count : undefined;
}
