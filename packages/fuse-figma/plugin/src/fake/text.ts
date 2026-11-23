/**
 * Text layers and glyphs: the fonts a text write needs, the per-character styles and bindings of a
 * text, and the base style a link or a TEXT property write resets.
 *
 * It models these rules. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 7. A text write needs every font the layer holds loaded, and a font write needs only the new
 *    font, as the typings and Figma's text guide say and as the plugin relies on since
 *    e152633d and 11df4d6e on 2026-10-19. `loadFontAsync` rejects a font the test marks
 *    unavailable. Clearing a text binding writes no font, so it needs none.
 * 10. A text layer keeps a font, size, line height and text field bindings per character, as
 *    the typings' range methods and Figma's guide to mixed styles describe. `fontName`,
 *    `fontSize` and `lineHeight` are `figma.mixed` when the characters differ, and
 *    `getRangeBoundVariable` is `figma.mixed` when the characters of the range bind different
 *    variables or some bind none, while `boundVariables` lists each alias any character binds.
 *    Writing `characters` gives every new character the first character's style. A range
 *    binding or font write restyles only its range, and a layer-wide write or binding every
 *    character, apart from the characters rules 54 and 55 leave. Rule 50 says which bindings a
 *    font write keeps. A `fontWeight` binding gives each character of its range the style its
 *    family names for the weight, which needs that font loaded, as Figma's guide to
 *    typography variables says. The fake names the style by `WEIGHT_STYLES`, Thin for 100
 *    up to Black for 900, and throws for another weight or a held style the table lacks.
 * 19. A text's sizing and its `textAutoResize` move together, as a real file showed on 2026-10-22
 *    (P3). FILL across a WIDTH_AND_HEIGHT text in a row switches it to HEIGHT and fills the row.
 *    Writing WIDTH_AND_HEIGHT on a text that fills keeps it HEIGHT and filling. A resize of a
 *    HEIGHT text fixes its width and keeps its height on its lines, and stops a fill as rule 14
 *    says, except on a 0-wide text (rule 31). No probe wrote HUG or FIXED on a text, or FILL down
 *    one. The fake takes HUG or FIXED only where the auto resize already reads it, so the write
 *    only stops a fill, and throws for the rest. A sizing write needs the text's fonts, as an auto
 *    resize write does.
 * 20. `textTruncation` and `maxLines`, as a real file showed on 2026-10-22 (P4). A `maxLines`
 *    write while truncation is DISABLED changes nothing, and the maximum reads null. ENDING on a
 *    text with no maximum reads `maxLines` 1, and null under ENDING is accepted. `maxLines` takes
 *    null or at least 1, as the typings say. Turning truncation DISABLED drops the maximum, since a
 *    text that does not truncate read null in P0 and P4. P4 ran with every font loaded, so it did
 *    not settle whether either write needs the text's fonts. The fake requires them, as for
 *    `textAutoResize`, so Plan fails where Apply might.
 * 21. `textAlignHorizontal` and `textAlignVertical` need the text's fonts, as the typings say. A
 *    new text sets its lines from the top left, LEFT and TOP. On 2026-10-22 all 420 labels of the
 *    real file's Button and Icon button sets read LEFT and TOP, and the plugin had written no
 *    alignment when it made them, so those are Figma's defaults for a new text (P0b).
 * 28. `letterSpacing` on a text. On 2026-10-23 a new text read `{ unit: "PERCENT", value: 0 }`,
 *    `{ unit: "PERCENT", value: -2.5 }` read back exactly and narrowed a hugging 18px Roboto Medium
 *    text from 122 to 116 wide, and `{ unit: "PIXELS", value: -0.45 }` read back as the 32-bit float
 *    -0.44999998807907104 (PL). The write needs the text's fonts, as every text write does (rule 7).
 *    The plugin writes one spacing for the whole layer, so the fake keeps one and never reads mixed.
 *    It does not lay out, so the spacing leaves the text's size as it was.
 * 30. `lineHeight` in `PERCENT` on a text. On 2026-10-23 a 16px Roboto Regular text read 150% and
 *    137.5% back exactly and was 24 and 22 tall. With `fontSize` bound to `Fuse density / label-text`
 *    it was 21, 24 and 21 tall at 150% in the Dense, Comfortable and Auto modes, so the line box
 *    follows the bound size (PH). The fake keeps the percent as written, through a font size
 *    binding. It does not set text, so the line box leaves the text's size as it was.
 * 50. A font write keeps a character's family binding only where its family stays. On 2026-10-26 a
 *    text `⇧⌘P` whose `fontFamily` bound `font-sans`, resolving to Roboto, took
 *    `setRangeFontName(0, 2, Inter Regular)`, and `getStyledTextSegments(['fontName',
 *    'boundVariables'])` read `[0,2)` Inter with no bound `fontFamily` and `[2,3)` Roboto still
 *    bound, while `fontName` read `figma.mixed` (G2). A whole `fontName` write on a bound `Apple` kept
 *    the binding with Roboto Medium and dropped it with Inter Regular, and on `⌘K` with `⌘` Inter
 *    unbound, Roboto Regular left `⌘` Roboto unbound and `K` bound (G8). A range write of Inter on a
 *    bound `K` unbound it, and Roboto written back left it unbound, while a range write of Roboto on
 *    a bound `AK` kept both bound (G9, G10). So a font write, on a range or the whole text, keeps a
 *    character's `fontFamily` binding where the character's family stays, drops it where the family
 *    changes, and binds no character. On `⌘K` a range binding of `⌘` to a STRING variable holding
 *    Inter gave `⌘` Inter bound to it, a range write of Inter Regular kept that binding, and a null
 *    range binding then left `⌘` Inter unbound and `K` Roboto bound to `font-sans` (G11). So a null
 *    range binding unbinds its range and keeps the font. A font write drops a `fontWeight` or
 *    `fontStyle` binding on what it writes. A whole `fontName` write over a text whose `fontWeight`
 *    bound a FLOAT variable dropped that binding on 2026-11-18 (PG8). On 2026-11-20, on `AB` with
 *    `fontStyle` bound to a STRING `Bold`, a whole write of Roboto Medium dropped it, and a range write
 *    of Roboto Medium or Inter Regular on `A` dropped it on `A` alone; with `fontWeight` bound to 700
 *    instead, the range write did the same (FT3). `getStyledTextSegments` splits the
 *    characters where the fields it is asked for differ. It reads `fontName`, `fontSize` and
 *    `boundVariables` alone and throws for another field.
 * 51. Linking a text's characters resets it to its base style. On 2026-10-26, in a component, writing
 *    `componentPropertyReferences = { characters: <TEXT property> }` after the range write of rule 50
 *    left the whole text one segment, Roboto bound to `font-sans`; linking first and writing the
 *    range after kept both segments (G3). `P⌘` with `⌘` Inter reset to Roboto Regular bound too, so
 *    the reset takes the style the range writes left alone at either end of the text, not the last
 *    character's (G7). The fake keeps that base style beside the characters' styles: a text starts
 *    with the style a new text types in, and each whole-text write or binding, of the font, size or
 *    line height, changes it as it changes every character, while a range write and a range binding
 *    leave it until every character holds one style. On `⌘K` with `⌘` Inter, a whole `fontSize` of 20
 *    and `lineHeight` of 28px reset with the link to Roboto Regular 20/28 bound to `font-sans` (G12a),
 *    while on `⌘K` never ranged, `setRangeFontSize(1, 2, 24)` gave `K` 24 and the link reset it to 14
 *    (G12c). Once every character holds one style, the base is that style. On 2026-11-20, on `AB` in
 *    Roboto Regular 14, range sizes of 20 on `A` and then `B`, one on both, and a range Roboto Bold
 *    on both each reset with the link to that style, and so did a `characters` write after a range
 *    size or font on `A`, which gave every character `A`'s style (FT1). The fake makes the style every
 *    character holds the base style after any write that restyles characters, leaving out range fills
 *    (rule 65), the moment rule 54's family state clears. FT1 ran range font and size writes
 *    and `characters` writes on a main component's text. The fake does the same after range bindings
 *    and range fills and on an instance's text sublayer, which no probe read.
 * 52. A TEXT property write resets the linked text of the instance. On 2026-10-26
 *    `setProperties({ [textProperty]: '⌘B' })` on an instance whose main drew `⇧⌘P` in two segments
 *    left its text sublayer one segment, Roboto bound to `font-sans`, and so did `'⇧⌘K'` and `'⇧⌘P'`,
 *    the default (G5), and `'B⌘'` on an instance of `P⌘` (G7). An instance at the default that took no
 *    write showed the main's segments (G4, G7). So `setProperties` gives each text the TEXT property
 *    links below the instance its base style (rule 51), which a sublayer shows from its main layer
 *    until a text write on it, over the characters it then shows, whatever the value. An instance at its
 *    default follows the ranges its main adds later: on 2026-11-20, after an instance of a component
 *    labeled `Save` was made, the main's label took a range Roboto Bold on `S` and a range size of 20
 *    on `a`, and the instance's label read the same three segments, with no override listed (FT5). So
 *    a text sublayer shows its main layer's styles and base style until a text write on it gives it
 *    its own. Only range writes were probed, and the fake has a sublayer follow every write.
 * 53. A range font write on an instance's text holds until the next TEXT write. On 2026-10-26, after
 *    rule 52's write, `setRangeFontName(0, 1, Inter Regular)` on the instance's text sublayer read
 *    `[0,1)` Inter unbound and `[1,2)` Roboto bound, `overrides` listed `width` and `height` alone,
 *    and the next `setProperties` reset it as rule 52 says (G6). Those were the instance's. On
 *    2026-11-20, on an instance of a hugging row around `Save`, a range size equal to the one the text
 *    held and a range fill listed no override, and a range Roboto Bold on `S` grew the label from 30
 *    to 31 wide and listed the instance itself with `height` and `width`, not the label (FT4). So a
 *    range write lists no override of its own, only the size of an instance it resizes. The fake's
 *    range write on a sublayer restyles the characters it shows and lists no override of the text.
 *    It measures text by size alone (rule 31), so a range size write or size binding that changes the
 *    label's width resizes an instance whose main hugs it and lists the instance's `width` and
 *    `height`, while a range font write, Bold on `S` included, changes no width in the fake and lists
 *    nothing.
 * 54. A whole-text family binding gives every character the variable's family, in its own style, and
 *    binds it, apart from a character with a family state of its own while the characters still
 *    differ, which keeps its font and its binding or none. On 2026-10-26
 *    `setBoundVariable('fontFamily', font-sans)` changed nothing on `⇧⌘P` with `⇧⌘` Inter unbound and
 *    `P` bound, nor on `⌘K` likewise, where a range write of Inter had dropped the binding. With null
 *    it unbound `K` too, and `font-sans` then bound `K` again and left `⌘` Inter unbound (G10). On
 *    2026-11-20 a whole binding of `Roboto` on `AB` in Inter Regular, never bound, gave both Roboto
 *    Regular bound, and Inter Bold went to Roboto Bold. On `AB` in Roboto with `A` set to Inter by a
 *    range write and never bound, whole bindings of `Inter`, `Arial` and `Roboto` each gave both
 *    characters that family, bound. The G10 sequence read `⌘` Inter unbound again, while a text that
 *    took the same range write with no binding before it, then null, then the binding, read both
 *    Roboto bound (FT2). So Figma tells the characters apart by the family state they hold, not by
 *    their family. From `⌘K` bound whole and then `⌘` set to Inter by a range write, a whole Roboto
 *    Regular left `⌘` Roboto unbound and `K` bound, and a whole binding then left `⌘` unbound. A whole
 *    Inter Regular gave both Inter unbound, and `characters = '⌘B'` gave both `⌘`'s Inter unbound, and
 *    a whole binding then bound both. A range Roboto on `⌘` left it unbound through the binding. A
 *    range binding of `⌘` to Roboto gave both Roboto bound, and a null range binding of `⌘` then left
 *    it unbound through a whole binding (FT6). From the same start, a range binding of `⌘` to an Inter
 *    variable kept `⌘` Inter bound to it through a whole Roboto binding, and so did a null range
 *    binding after it leave `⌘` unbound. On `⌘K` in Roboto never bound, a range binding of `⌘` to Inter
 *    gave `⌘` Inter bound and left `K` unbound, and a whole Roboto binding then left `⌘` bound to Inter
 *    and bound `K` (FT7). A range font write on a never-bound character set no state (T2f). So a
 *    character takes a family state of its own from a range family binding, and from a range font
 *    write or a null range binding that drops its family binding. It keeps the state through font
 *    writes, whole or on a range, and through null and whole bindings, and every character loses it
 *    once every character holds one style, apart from the state itself and range fills, the moment
 *    rule 51 makes that style the base. A range binding gives its range the variable's family and
 *    binds it: a range binding of `font-sans` on a `⌘` Roboto unbound bound it (G9), and a range
 *    binding of `Roboto` on `A` of `AB` in Inter gave `A` Roboto bound and left `B` Inter unbound
 *    (FT2).
 * 55. A whole-text binding of another field gives every character its value and binds every
 *    character but one with a family state of its own as rule 54 says. On 2026-10-26, in a component,
 *    `setBoundVariable('fontSize', v)` with a FLOAT `v` of 18 on `⌘K` with `⌘` Inter unbound gave `⌘`
 *    18 with no `fontSize` binding and `K` 18 bound to `v`, and the link then reset the text to Roboto
 *    Regular 18 bound to `v`, its family bound to `font-sans` (G12b). On 2026-11-20 a `⌘` set to Inter
 *    and never bound took 18 and the binding, and a `⌘` that lost its `Roboto` binding to the range
 *    write took 18 without it (FT2). So the binding gives every character and the base style its
 *    value, and binds the base style and every character without a family state of its own. The
 *    probes bound `fontSize` alone, over a character that lost its binding, and the fake treats
 *    `lineHeight` and `fontStyle`, and a character a range family binding gave the state, the same. A
 *    `fontWeight` binding binds every character: on 2026-11-18 a whole-text binding of a 400/500
 *    FLOAT variable on `⌘K Search`, its `⌘` set to Inter Regular by `setRangeFontName` first, bound
 *    every range, and a mode switch moved `⌘` to Inter Medium and the rest to Roboto Medium, each in
 *    its own family (PG13). A range binding bound only its range, which a mode switch then moved alone
 *    (PG13).
 * 65. A text's fills are per character, as the typings' `setRangeFills` and `getRangeFills` and the
 *    `fills` of a `StyledTextSegment` say. A range write needs the range's fonts loaded, as the
 *    typings say, gives its characters the paints, and leaves the base style. A whole `fills` write
 *    gives every character the layer's paints, and `fills` reads `figma.mixed` where the characters
 *    differ. The whole `fills`, a range's fills and the segments read one fill per character, its
 *    range's or the layer's, so characters with equal fills read as one. On 2026-11-19 a real
 *    file's range fills, each bound to a variable, read back through `getStyledTextSegments(['fills'])`
 *    as merged runs, each paint with its variable. They survived `fontSize` and `fontName` writes,
 *    followed the frame's light and dark modes, and showed on an instance, which followed later range
 *    writes on its main (rule 52). A whole `fills` write reset them, and a `characters` write, even of the same
 *    text, gave every character the first character's fill. The fake keeps them through every write
 *    but those two and the writes that give every character one style: a text style link (rule 60)
 *    and a TEXT link or write (rules 51 and 52). Its characters write gives every character the first
 *    one's style, as rule 10 says. A line break paints in the fill of the character before it. In a
 *    scratch file on 2026-11-20, with `ab;\ncd` (live probe NL1–NL4): coloring `;` red read `[2,4]`
 *    red, the break included (NL1); `setRangeFills(3, 4, black)` on the break left it red and read it
 *    back red (NL2); coloring only the break red was dropped and the whole text read black (NL3); and
 *    the character after a break kept its own fill (NL4). The fake keeps each break's own fill and
 *    shows the one before it in every read. No probe wrote a fill on a break that starts the text,
 *    so the fake shows that break's own fill.
 * 66. A text's `hyperlink` is a `HyperlinkTarget`, a URL or a node, or null, as the typings say. A real
 *    file showed (live probe 2026-11-19, HL1–HL4): a URL written on a whole text reads back
 *    exactly as written and draws no underline and no color, `textDecoration` staying NONE and the
 *    fills as they were; the link stays through a `characters` write, of the same text or a
 *    new one, and through `setTextStyleIdAsync` and a `fontSize` write;
 *    `setRangeHyperlink` on part of a linked text makes the whole read `figma.mixed`. The fake
 *    keeps a link per character, a range's or the whole text's (RH1, RH7). A range write links its
 *    characters alone, or unlinks them with null (RH1, RH3), and takes only an absolute `http` or
 *    `https` URL, refusing a fragment and a path as `Unsupported or invalid hyperlink url` (RH2) and
 *    every other scheme and a node, which no probe wrote. A whole write gives every character its
 *    link, so a null clears every range's (RH6). Fills, decoration and size writes keep a range's
 *    link (RH4); a `characters` write, a text style link and a TEXT link or write treat it as they
 *    treat a range fill (RH5). The whole `hyperlink` reads `figma.mixed` where the characters
 *    differ. A range link write on a sublayer an instance shows lists the overrides a range
 *    decoration write lists (rule 68, RD8), by analogy, since no probe wrote one. The package README records the probes.
 *    A link write in a fresh run raised no error without a `loadFontAsync` call, but the font may
 *    have stayed loaded from earlier, so the fake still requires the text's fonts, as for
 *    `textAutoResize` (rule 20), and Plan fails where Apply might. The same file showed (live probe
 *    2026-11-19, DS1–DS3): an underline, offset, thickness or decoration color write keeps a text
 *    linked to its style; a `characters` write keeps the underline, its offset and thickness and the
 *    style link; a style link resets `textDecoration` to NONE and `textDecorationOffset` to null, as
 *    `Text/sm/regular` sets no decoration; and an offset of 2.8px reads back as 2.799999952. The
 *    fake resets those two fields on a style link and leaves the thickness and color, which the probe
 *    did not read after one.
 * 68. A text's decoration is per character, as the typings' `setRangeTextDecoration`, its offset,
 *    thickness and color range writes, and the decoration fields of a `StyledTextSegment` say. The
 *    fake keeps each character's line and the underline fields it remembers, and the whole text's,
 *    which a character without a decoration of its own shows. A field reads only while its
 *    character is underlined, as `AUTO` where never written (RD1). A range field write, and a whole
 *    one, on characters with no underline throws `Cannot set text decoration offset on a
 *    non-underlined text range` (RD1b, RD13b). Font and size writes keep a range's line and fields
 *    (RD2); a `characters` write, a text style link and a TEXT link or write treat them as they
 *    treat a range fill (RD3). A whole line write gives every character the line and keeps the
 *    fields each remembers (RD4, RD4b, RD10). A whole field write goes to every character and to
 *    the text (RD9, RD11, RD12). The whole fields read the value the underlined characters share,
 *    `figma.mixed` where they differ, and null where none is underlined (RD1, RD11). A sublayer
 *    shows its main's lines and follows its main's writes (RD5 to RD7, rule 52); a range decoration
 *    write on it gives it styles of its own and lists `characters` and `styledTextSegments`
 *    overrides (RD8), which `removeOverrides` drops, so it shows its main's again. A bound
 *    underline color reads its variable's value in the text's modes and keeps its binding (RD14).
 *    The fake does not model `textDecorationStyle`, which a range holds too (RD1, RD10) and the
 *    plugin neither writes nor reads. The package README records the probes.
 * 69. `appendChild` and `insertChild` refuse to move a layer whose texts hold a font Figma cannot
 *    load. On 2026-11-23 Apply on the owner's file stopped with `in insertChild: unloaded font "Neo
 *    Sans Medium". Please call figma.loadFontAsync({ family: "Neo Sans", style: "Medium" }) and
 *    await the returned promise first.`, where the org has no Neo Sans (#525) and a branded heading
 *    held it. Probes MV1 and MV2 on a private draft file the same day moved frames holding Roboto,
 *    which the run had not loaded, within a frame and on the page, and Figma took each move. The
 *    typings document no font rule for either method. So the fake refuses a font the test marks
 *    unavailable, loaded or not, with Figma's message, and moves a layer whose fonts load. A text
 *    that holds such a font reads `hasMissingFont` true, as the typings describe it.
 */

import { ownNumber, resolveNumber, resolveString } from "./modes.ts";
import { charactersOf, shownStyles } from "./overrides.ts";
import { baseStyleOf, f32, SHARED_DATA_SEPARATOR, textLayerOf, write } from "./state.ts";
import type { CharacterDecoration, CharacterStyle, FileState, NodeState } from "./state.ts";
import { childrenOf } from "./tree.ts";
import { alias, fileVariable, requireType } from "./variables.ts";

export function fontKey(font: FontNameInput): string {
  return `${font.family}${SHARED_DATA_SEPARATOR}${font.style ?? ""}`;
}

/** Whether the run loaded a font, or every style of its family (rule 7). */
export function fontLoaded(file: FileState, font: FontName): boolean {
  return file.loadedFonts.has(fontKey(font)) || file.loadedFonts.has(fontKey({ family: font.family }));
}

export function requireFont(state: NodeState, font: FontName, what: string): void {
  if (!fontLoaded(state.file, font)) {
    throw new Error(
      `Cannot write ${what} of ${state.id} with unloaded font "${font.family} ${font.style}". Please call figma.loadFontAsync({ family: "${font.family}", style: "${font.style}" }) and await the returned promise first.`
    );
  }
}

/** The distinct fonts of some characters' styles. */
export function distinctFonts(styles: readonly CharacterStyle[]): FontName[] {
  const fonts = new Map(styles.map((style) => [fontKey(style.font), style.font] as const));
  return [...fonts.values()].map((font) => ({ ...font }));
}

/** The fonts a text layer holds (rule 7). */
export function heldFonts(state: NodeState): readonly FontName[] {
  return distinctFonts(shownStyles(state));
}

export function requireHeldFonts(state: NodeState, what: string): void {
  for (const font of heldFonts(state)) {
    requireFont(state, font, what);
  }
}

/**
 * Give a sublayer the styles, base style, whole-text decoration and link it shows from its main
 * layer as its own, which a text write on it then changes (rules 52 and 68), and give a text one
 * style for each character it shows.
 */
export function holdStyles(state: NodeState): void {
  if (!state.ownStyles) {
    state.baseStyle = baseStyleOf(state);
    const layer = textLayerOf(state);
    state.textDecoration = layer.textDecoration;
    state.textDecorationOffset = layer.textDecorationOffset;
    state.textDecorationThickness = layer.textDecorationThickness;
    state.textDecorationColor = layer.textDecorationColor;
    state.hyperlink = layer.hyperlink;
  }
  state.styles = shownStyles(state);
  state.ownStyles = true;
}

/**
 * Apply an update to some styles, once for each distinct record, so characters that shared a record
 * share its update too.
 */
function updateEach(
  styles: readonly CharacterStyle[],
  update: (style: CharacterStyle) => CharacterStyle
): readonly CharacterStyle[] {
  const updated = new Map<CharacterStyle, CharacterStyle>();
  return styles.map((style) => {
    const known = updated.get(style);
    if (known !== undefined) {
      return known;
    }
    const next = update(style);
    updated.set(style, next);
    return next;
  });
}

/**
 * Restyle the characters from `start` to `end` (rule 10). Once every character holds one style, that
 * style is the base style, and no character keeps a family state of its own (rules 51 and 54).
 */
export function restyle(
  state: NodeState,
  start: number,
  end: number,
  update: (style: CharacterStyle) => CharacterStyle
): void {
  holdStyles(state);
  const sized = sizesOf(state.styles);
  const within = updateEach(state.styles.slice(start, end), update);
  state.styles = [...state.styles.slice(0, start), ...within, ...state.styles.slice(end)];
  settle(state);
  // A size write or binding changes the width of a text that hugs its characters (rule 31).
  if (sizesOf(state.styles) !== sized) {
    remeasure(state);
  }
}

/** Restyle every character and the base style, as a whole-text write does (rules 10 and 51). */
export function restyleWhole(state: NodeState, update: (style: CharacterStyle) => CharacterStyle): void {
  holdStyles(state);
  state.baseStyle = update(state.baseStyle);
  restyle(state, 0, state.styles.length, update);
}

/** The key each style record compares by, computed once per record. */
const styleKeys = new WeakMap<CharacterStyle, string>();

/** What characters holding one style share, apart from range fills and their family state (rules 51, 54). */
function styleKey(style: CharacterStyle): string {
  const known = styleKeys.get(style);
  if (known !== undefined) {
    return known;
  }
  const key = JSON.stringify([
    fontKey(style.font),
    style.fontSize,
    style.lineHeight,
    [...style.bindings].sort(([left], [right]) => left.localeCompare(right)),
  ]);
  styleKeys.set(style, key);
  return key;
}

/**
 * Once every character holds one style, make it the base style and clear each character's own family
 * state (rule 51, FT1; rule 54, FT6). Range fills stay on their characters and off the base, which a
 * link resets (rule 65).
 */
function settle(state: NodeState): void {
  const [first, ...rest] = state.styles;
  if (first === undefined) {
    return;
  }
  const key = styleKey(first);
  if (rest.some((style) => style !== first && styleKey(style) !== key)) {
    return;
  }
  const { fills: _ranged, decoration: _decorated, hyperlink: _linked, ownFamily: _own, ...style } = first;
  state.baseStyle = style;
  state.styles = updateEach(state.styles, ({ ownFamily: _cleared, ...kept }) => kept);
}

/**
 * Give every character the first one's style, as a `characters` write does (rule 10), which makes it
 * the base style (rule 51).
 *
 * @param state - The text.
 * @param length - The number of characters written.
 * @returns The style every character takes.
 */
export function restyleAsFirst(state: NodeState, length: number): CharacterStyle {
  holdStyles(state);
  const [first] = state.styles;
  if (first === undefined) {
    throw new Error(`${state.id} holds no character style.`);
  }
  state.styles = Array.from({ length: Math.max(1, length) }, () => first);
  settle(state);
  return first;
}

function withBinding(
  style: CharacterStyle,
  field: VariableBindableTextField,
  id: string | undefined
): ReadonlyMap<VariableBindableTextField, string> {
  const bindings = new Map(style.bindings);
  if (id === undefined) {
    bindings.delete(field);
  } else {
    bindings.set(field, id);
  }
  return bindings;
}

/**
 * The standard style name for each weight a `fontWeight` variable can bind (rule 10). The fake
 * models only these names, so a family with other style names throws.
 */
const WEIGHT_STYLES: ReadonlyMap<number, string> = new Map([
  [100, "Thin"],
  [200, "ExtraLight"],
  [300, "Light"],
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
  [800, "ExtraBold"],
  [900, "Black"],
]);

const WEIGHTED_STYLES: ReadonlySet<string> = new Set(WEIGHT_STYLES.values());

/** The style a font takes for a bound weight (rule 10). */
export function weightedStyle(font: FontName, weight: number): string {
  const style = WEIGHT_STYLES.get(weight);
  if (style === undefined) {
    throw new Error(`The fake Figma file does not model the font weight ${weight}.`);
  }
  if (!WEIGHTED_STYLES.has(font.style)) {
    throw new Error(`The fake Figma file does not model the weight of the style "${font.style}".`);
  }
  return style;
}

/**
 * Bind or unbind a text field of the characters from `start` to `end` (rules 7 and 10), which
 * leaves the base style (rule 51). A family, style or weight binding changes the font of those
 * characters, and a size or line height binding their size or line height.
 */
export function bindTextRange(
  state: NodeState,
  start: number,
  end: number,
  field: VariableBindableTextField,
  variable: Variable | null
): void {
  if (variable === null) {
    // A null range binding that drops a family binding gives the character a family state of its
    // own, as a range font write does (rule 54, FT6).
    restyle(state, start, end, (style) => {
      const unbound = { ...style, bindings: withBinding(style, field, undefined) };
      return field === "fontFamily" && style.bindings.has(field) ? { ...unbound, ownFamily: true } : unbound;
    });
    write(state, `unbind ${field}`);
    return;
  }
  const { update, id } = boundUpdate(state, field, variable);
  const restyled = shownStyles(state).slice(start, end).map(update);
  for (const font of distinctFonts(restyled)) {
    requireFont(state, font, field);
  }
  // A range family binding gives its characters a family state of their own (rule 54, FT7).
  const own = field === "fontFamily" ? ({ ownFamily: true } as const) : {};
  restyle(state, start, end, (style) => ({
    ...update(style),
    bindings: withBinding(style, field, id),
    ...own,
  }));
  write(state, `bind ${field}`);
}

/**
 * Bind or unbind a text field of every character and of the base style (rules 10 and 51). The binding
 * gives each character its value and binds it, apart from a character with a family state of its own
 * (rule 54): a family binding leaves that one as it is, and another field's gives it the value alone
 * (rules 54 and 55). A weight binding binds that character too (PG13). Null unbinds every
 * character.
 */
export function bindWholeText(
  state: NodeState,
  field: VariableBindableTextField,
  variable: Variable | null
): void {
  if (variable === null) {
    restyleWhole(state, (style) => ({ ...style, bindings: withBinding(style, field, undefined) }));
    write(state, `unbind ${field}`);
    return;
  }
  const { update, id } = boundUpdate(state, field, variable);
  const bind = (style: CharacterStyle): CharacterStyle => {
    if (field === "fontWeight" || style.ownFamily !== true) {
      return { ...update(style), bindings: withBinding(style, field, id) };
    }
    return field === "fontFamily" ? style : update(style);
  };
  for (const font of distinctFonts(shownStyles(state).map(bind))) {
    requireFont(state, font, field);
  }
  restyleWhole(state, bind);
  write(state, `bind ${field}`);
}

/** What a text field binding does to a character's style, and the id of the variable it binds. */
type TextBinding = {
  readonly update: (style: CharacterStyle) => CharacterStyle;
  readonly id: string;
};

/**
 * What a binding of a text field does to a character's style, and the bound variable's id. A family,
 * style or weight binding changes the font, and a size or line height binding the size or line height
 * (rule 10). It needs the text's fonts loaded (rule 7).
 */
function boundUpdate(state: NodeState, field: VariableBindableTextField, variable: Variable): TextBinding {
  requireHeldFonts(state, field);
  const bound = fileVariable(state.file, variable);
  const update = ((): ((style: CharacterStyle) => CharacterStyle) => {
    switch (field) {
      case "fontFamily": {
        requireType(bound, "STRING", field);
        const family = resolveString(state.file, bound, state);
        return (style) => ({ ...style, font: { family, style: style.font.style } });
      }
      case "fontStyle": {
        requireType(bound, "STRING", field);
        const fontStyle = resolveString(state.file, bound, state);
        return (style) => ({ ...style, font: { family: style.font.family, style: fontStyle } });
      }
      case "fontWeight": {
        requireType(bound, "FLOAT", field);
        const weight = resolveNumber(state.file, bound, state);
        return (style) => ({
          ...style,
          font: { family: style.font.family, style: weightedStyle(style.font, weight) },
        });
      }
      case "fontSize": {
        requireType(bound, "FLOAT", field);
        const fontSize = f32(resolveNumber(state.file, bound, state));
        return (style) => ({ ...style, fontSize });
      }
      case "lineHeight": {
        requireType(bound, "FLOAT", field);
        const value = f32(resolveNumber(state.file, bound, state));
        return (style) => ({ ...style, lineHeight: { unit: "PIXELS", value } });
      }
      default:
        throw new Error(`The fake Figma file does not model binding ${field}.`);
    }
  })();
  return { update, id: bound.id };
}

/**
 * A character's style once a font is written over it, which keeps its family binding only where its
 * family stays and drops its weight and style bindings (rule 50, PG8, FT3).
 */
export function withFont(style: CharacterStyle, font: FontName): CharacterStyle {
  const bindings = new Map(style.bindings);
  if (style.font.family !== font.family) {
    bindings.delete("fontFamily");
  }
  bindings.delete("fontWeight");
  bindings.delete("fontStyle");
  return { ...style, font: { family: font.family, style: font.style }, bindings };
}

/** Write a font to every character and the base style, needing only that font loaded (rules 7, 10, 50). */
export function writeWholeFont(state: NodeState, font: FontName): void {
  requireFont(state, font, "fontName");
  write(state, "fontName");
  restyleWhole(state, (style) => withFont(style, font));
}

/**
 * Write a font to the characters from `start` to `end`, which needs only that font loaded (rules 7,
 * 10 and 50). A character whose family binding the write drops takes a family state of its own
 * (rules 54 and 55).
 */
export function writeRangeFont(state: NodeState, start: number, end: number, font: FontName): void {
  const label = `fontName ${start}-${end}`;
  requireFont(state, font, label);
  write(state, label);
  restyle(state, start, end, (style) => {
    const written = withFont(style, font);
    return style.bindings.has("fontFamily") && !written.bindings.has("fontFamily")
      ? { ...written, ownFamily: true }
      : written;
  });
}

/**
 * The horizontal alignment a text shows (rule 41): a sublayer shows its main layer's until it
 * overrides it.
 */
export function alignmentOf(state: NodeState): TextNode["textAlignHorizontal"] {
  const source = state.mirrorOf;
  return source === undefined || state.overridden.has("textAlignHorizontal")
    ? state.textAlignHorizontal
    : alignmentOf(source);
}

export function requireRange(state: NodeState, start: number, end: number): void {
  const { length } = charactersOf(state);
  if (start < 0 || end > length || start >= end) {
    throw new Error(`The range ${start} to ${end} is outside the ${length} characters of ${state.id}.`);
  }
}

/** Give every character a text shows its base style, as a link or a TEXT write does (rules 51, 52). */
export function resetStyles(state: NodeState): void {
  holdStyles(state);
  const base = state.baseStyle;
  state.styles = Array.from({ length: Math.max(1, charactersOf(state).length) }, () => base);
  // A reset follows a TEXT write or a link, which can change the characters a text shows as well as
  // their sizes, so a text that hugs them takes their width again (rule 31).
  remeasure(state);
}

/**
 * What a segment compares of a character: the fields asked for, with the fills it paints with, the
 * decoration it shows and its link (rules 50, 65, 66 and 68).
 */
export function segmentKey(
  style: CharacterStyle,
  fills: readonly Paint[],
  decoration: CharacterDecoration,
  hyperlink: HyperlinkTarget | null,
  fields: readonly string[]
): string {
  return JSON.stringify([
    fields.includes("fontName") ? fontKey(style.font) : "",
    fields.includes("fontSize") ? style.fontSize : "",
    fields.includes("fills") ? fills : "",
    fields.includes("textDecoration") ? decoration.line : "",
    fields.includes("textDecorationOffset") ? decoration.offset : "",
    fields.includes("textDecorationThickness") ? decoration.thickness : "",
    fields.includes("textDecorationColor") ? decoration.color : "",
    fields.includes("hyperlink") ? hyperlink : "",
    fields.includes("boundVariables")
      ? [...style.bindings].sort(([left], [right]) => left.localeCompare(right))
      : [],
  ]);
}

/** The variable each text field of a character binds, as a segment's `boundVariables` lists them. */
export function segmentBindings(style: CharacterStyle): NonNullable<StyledTextSegment["boundVariables"]> {
  const bound: { [field in VariableBindableTextField]?: VariableAlias } = {};
  for (const [field, id] of style.bindings) {
    bound[field] = alias(id);
  }
  return bound;
}

/**
 * Refuse to move a layer whose texts, its own included, hold a font Figma cannot load (rule 69).
 *
 * @param state - The layer a move carries.
 * @param method - The method that moves it, for the message.
 */
export function requireMovableFonts(state: NodeState, method: string): void {
  if (state.type === "TEXT") {
    const font = heldFonts(state).find((each) => fontUnavailable(state.file, each));
    if (font !== undefined) {
      throw new Error(
        `in ${method}: unloaded font "${font.family} ${font.style}". Please call figma.loadFontAsync({ family: "${font.family}", style: "${font.style}" }) and await the returned promise first.`
      );
    }
  }
  for (const child of childrenOf(state)) {
    requireMovableFonts(child, method);
  }
}

export function fontUnavailable(file: FileState, font: FontNameInput): boolean {
  return file.unavailableFonts.some(
    (missing) =>
      missing.family === font.family && (missing.style === undefined || missing.style === font.style)
  );
}

/**
 * Give a text that hugs its characters the width they take (rule 31). The fake measures no glyphs,
 * so each character takes half its font size, an approximation that keeps widths deterministic, and
 * an empty text is 0 wide, as a real one is.
 *
 * @param state - The text.
 */
export function remeasure(state: NodeState): void {
  if (state.textAutoResize !== "WIDTH_AND_HEIGHT") {
    return;
  }
  const { length } = charactersOf(state);
  const sizes = shownStyles(state).slice(0, length);
  state.width = f32(sizes.reduce((width, style) => width + style.fontSize * 0.5, 0));
  // The measured width is the text's own, which a sublayer no longer shows from its main layer (rule 8).
  ownNumber(state, "width");
}

/** The font size of each character, as text two runs of styles share where their sizes agree. */
function sizesOf(styles: readonly CharacterStyle[]): string {
  return styles.map((style) => style.fontSize).join();
}
