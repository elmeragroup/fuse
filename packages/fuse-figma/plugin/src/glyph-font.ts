/**
 * The kit's glyph font on a text. The glyph font draws the ranges of the text's characters that hold
 * its glyphs, since the family a label binds lacks them and Figma falls back to no other font (G1). A
 * range write of another family unbinds that range's family alone (G2, G9), so a text reads as
 * segments, the glyph font unbound between runs of the label's family bound. A range bound to a
 * variable that holds the glyph font keeps that binding through a write of the font, and a null range
 * binding unbinds it and keeps the font (G11). A whole-text family
 * binding leaves the glyph font as it is (G10), and a whole-text font write replaces it (G8). Linking
 * a text's characters to a TEXT property (G3) and writing that property on an instance (G5) reset the
 * whole text to the label's own style (G7), so the ranges go on after both, and an instance's after
 * each of its TEXT writes (G6).
 */

import { glyphRanges } from "../../src/components/kit-spec.ts";
import type { TextRange } from "../../src/components/kit-spec.ts";
import type { Run } from "./fields.ts";
import { requireFont } from "./fonts.ts";
import { change } from "./plan.ts";

/** One character's font and the id of the variable its family binds, if any. */
export type HeldCharacter = {
  readonly font: FontName;
  readonly family: string | undefined;
};

/** Each character of a text with its font and its family binding, read from its styled segments. */
function heldCharacters(text: TextNode): readonly HeldCharacter[] {
  return text.getStyledTextSegments(["fontName", "boundVariables"]).flatMap((segment) =>
    Array.from({ length: segment.end - segment.start }, () => ({
      font: segment.fontName,
      family: segment.boundVariables?.fontFamily?.id,
    }))
  );
}

/**
 * The characters of a text that take the label's own font: all but its glyph ranges, or every one
 * where the run gives the text new characters, which take the style of a character a glyph range
 * may hold.
 *
 * @param rewrites - Whether the run writes or links the text's characters.
 * @returns The characters, each with its font and family binding.
 */
export function baseCharacters(run: Run, text: TextNode, rewrites: boolean): readonly HeldCharacter[] {
  const held = heldCharacters(text);
  if (rewrites) {
    return held;
  }
  const ranges = glyphRanges(text.characters, run.glyphFont);
  return held.filter((_, index) => !ranges.some((range) => index >= range.start && index < range.end));
}

/**
 * Plan the glyph font on the glyph ranges of the characters a text shows, at the label's style, and
 * unbind the family where a range still binds one. A range bound to a variable that holds the glyph
 * font keeps the binding through a write of that font, and a null range binding then unbinds it and
 * keeps the font (G11). Where the text keeps its characters, the font write and the unbinding each go
 * only on the ranges that need them. Otherwise the operation finds the ranges again when it runs, in
 * the characters the text then shows.
 *
 * @param characters - The characters the text shows once the run's earlier operations have run.
 * @param style - The label's font style, which the glyph font takes.
 * @param rewritten - Whether an earlier operation of the run writes the font of every character of
 *   the text, which gives the ranges that font and drops their family binding, since the family
 *   changes (G8). The ranges are then written whatever they read now. New characters show no ranges
 *   to compare, so they are written then too.
 */
export function planGlyphRanges(
  run: Run,
  text: TextNode,
  label: string,
  characters: string,
  style: string,
  rewritten: boolean
): void {
  const ranges = glyphRanges(characters, run.glyphFont);
  if (ranges.length === 0) {
    return;
  }
  const font: FontName = { family: run.glyphFont.family, style };
  const shown = (planned: readonly TextRange[]): string =>
    planned.map((range) => `${range.start}-${range.end}`).join(", ");
  if (rewritten || text.characters !== characters) {
    change(run.plan, label, `font at ${shown(ranges)} → ${font.family} ${font.style}`, () => {
      for (const range of glyphRanges(text.characters, run.glyphFont)) {
        text.setRangeFontName(range.start, range.end, font);
      }
    });
    requireFont(run, label, font);
    return;
  }
  const held = heldCharacters(text);
  const within = (range: TextRange): readonly HeldCharacter[] => held.slice(range.start, range.end);
  const refonted = ranges.filter((range) =>
    within(range).some(
      (character) => character.font.family !== font.family || character.font.style !== font.style
    )
  );
  // A write of the glyph font drops a binding where it changes the family (G2) and keeps one where
  // the family is already the glyph font's (G11), so only those need a null binding.
  const unbound = ranges.filter((range) =>
    within(range).some((character) => character.family !== undefined && character.font.family === font.family)
  );
  if (refonted.length > 0) {
    change(run.plan, label, `font at ${shown(refonted)} → ${font.family} ${font.style}`, () => {
      for (const range of refonted) {
        text.setRangeFontName(range.start, range.end, font);
      }
    });
    requireFont(run, label, font);
  }
  if (unbound.length > 0) {
    change(run.plan, label, `unbind the family at ${shown(unbound)}`, () => {
      for (const range of unbound) {
        text.setRangeBoundVariable(range.start, range.end, "fontFamily", null);
      }
    });
  }
}
