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
 *    character, apart from a layer-wide binding (rules 54 and 55). Rule 50 says which family
 *    bindings a font write keeps. A `fontWeight` binding gives each character of its range the style its
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
 *    range binding unbinds its range and keeps the font. No probe wrote a font over a bound
 *    `fontStyle` or `fontWeight`, so those bindings stay. `getStyledTextSegments` splits the
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
 *    leave it. On `⌘K` with `⌘` Inter, a whole `fontSize` of 20 and `lineHeight` of 28px reset with
 *    the link to Roboto Regular 20/28 bound to `font-sans` (G12a), while on `⌘K` never ranged,
 *    `setRangeFontSize(1, 2, 24)` gave `K` 24 and the link reset it to 14 (G12c). The probes leave
 *    open what the base is once a range write covered every character, or after a characters write,
 *    which the fake leaves as it was.
 * 52. A TEXT property write resets the linked text of the instance. On 2026-10-26
 *    `setProperties({ [textProperty]: '⌘B' })` on an instance whose main drew `⇧⌘P` in two segments
 *    left its text sublayer one segment, Roboto bound to `font-sans`, and so did `'⇧⌘K'` and `'⇧⌘P'`,
 *    the default (G5), and `'B⌘'` on an instance of `P⌘` (G7). An instance at the default that took no
 *    write showed the main's segments (G4, G7). So `setProperties` gives each text the TEXT property
 *    links below the instance its base style (rule 51), which a sublayer takes from its main layer when
 *    the instance is made, over the characters it then shows, whatever the value.
 * 53. A range font write on an instance's text holds until the next TEXT write. On 2026-10-26, after
 *    rule 52's write, `setRangeFontName(0, 1, Inter Regular)` on the instance's text sublayer read
 *    `[0,1)` Inter unbound and `[1,2)` Roboto bound, `overrides` listed the sublayer with `width` and
 *    `height` alone, and the next `setProperties` reset it as rule 52 says (G6). So the fake's range
 *    write on a sublayer restyles the characters it shows and lists no override. It does not measure
 *    text, so it lists no size either.
 * 54. A whole-text family binding binds only the characters already in the variable's family, and
 *    changes no font. On 2026-10-26 `setBoundVariable('fontFamily', font-sans)` changed nothing on
 *    `⇧⌘P` with `⇧⌘` Inter unbound and `P` bound, nor on `⌘K` likewise. With null it unbound `K` too,
 *    and `font-sans` then bound `K` again and left `⌘` Inter unbound (G10). A range binding of
 *    `font-sans` on a `⌘` Roboto unbound bound it (G9). No probe bound a range or a whole text whose
 *    family differs from the variable's value across every character, so the fake keeps the range
 *    binding's font change of rule 10 and gives a whole-text binding the rule G10 read.
 * 55. A whole-text binding of another field binds only the characters in the base style's family. On
 *    2026-10-26, in a component, `setBoundVariable('fontSize', v)` with a FLOAT `v` of 18 on `⌘K`
 *    with `⌘` Inter unbound gave `⌘` 18 with no `fontSize` binding and `K` 18 bound to `v`, and the
 *    link then reset the text to Roboto Regular 18 bound to `v`, its family bound to `font-sans`
 *    (G12b). So the binding gives every character and the base style its value, and binds the
 *    characters whose family is the base style's, and the base style. The probe bound `fontSize`
 *    alone, and the fake treats `lineHeight`, `fontStyle` and `fontWeight` the same. It left open
 *    whether Figma tells the characters apart by their family or by the family binding they lost.
 */

import { nearestInstance, propertyValue, rootMain } from "./overrides.ts";
import { f32, SHARED_DATA_SEPARATOR, write } from "./state.ts";
import type { CharacterStyle, FileState, NodeState } from "./state.ts";
import { alias, fileVariable, requireType, resolveNumber, resolveString } from "./variables.ts";

export function fontKey(font: FontNameInput): string {
  return `${font.family}${SHARED_DATA_SEPARATOR}${font.style ?? ""}`;
}

function fontLoaded(file: FileState, font: FontName): boolean {
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
  return distinctFonts(state.styles);
}

export function requireHeldFonts(state: NodeState, what: string): void {
  for (const font of heldFonts(state)) {
    requireFont(state, font, what);
  }
}

/** Restyle the characters from `start` to `end` (rule 10). */
export function restyle(
  state: NodeState,
  start: number,
  end: number,
  update: (style: CharacterStyle) => CharacterStyle
): void {
  state.styles = state.styles.map((style, index) => (index >= start && index < end ? update(style) : style));
}

/** Restyle every character and the base style, as a whole-text write does (rules 10 and 51). */
export function restyleWhole(state: NodeState, update: (style: CharacterStyle) => CharacterStyle): void {
  restyle(state, 0, state.styles.length, update);
  state.baseStyle = update(state.baseStyle);
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
function weightedStyle(font: FontName, weight: number): string {
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
    restyle(state, start, end, (style) => ({ ...style, bindings: withBinding(style, field, undefined) }));
    write(state, `unbind ${field}`);
    return;
  }
  const { update, id } = boundUpdate(state, field, variable);
  const restyled = state.styles.slice(start, end).map(update);
  for (const font of distinctFonts(restyled)) {
    requireFont(state, font, field);
  }
  restyle(state, start, end, (style) => ({ ...update(style), bindings: withBinding(style, field, id) }));
  write(state, `bind ${field}`);
}

/**
 * Bind or unbind a text field of every character and of the base style (rules 10 and 51). A family
 * binding binds only the characters whose family is already the variable's value, and changes no font
 * (rule 54). Another field's binding gives every character its value, and binds only those in the base
 * style's family (rule 55). Null unbinds every character.
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
  if (field === "fontFamily") {
    requireHeldFonts(state, field);
    const bound = fileVariable(state.file, variable);
    requireType(bound, "STRING", field);
    const family = resolveString(state.file, bound, state);
    restyleWhole(state, (style) =>
      style.font.family === family ? { ...style, bindings: withBinding(style, field, bound.id) } : style
    );
    write(state, `bind ${field}`);
    return;
  }
  const { update, id } = boundUpdate(state, field, variable);
  for (const font of distinctFonts(state.styles.map(update))) {
    requireFont(state, font, field);
  }
  const { family } = state.baseStyle.font;
  restyleWhole(state, (style) => ({
    ...update(style),
    bindings: style.font.family === family ? withBinding(style, field, id) : style.bindings,
  }));
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
 * family stays (rule 50).
 */
export function withFont(style: CharacterStyle, font: FontName): CharacterStyle {
  return {
    ...style,
    font: { family: font.family, style: font.style },
    bindings:
      style.font.family === font.family ? style.bindings : withBinding(style, "fontFamily", undefined),
  };
}

/**
 * Write a font to the characters from `start` to `end`, which needs only that font loaded
 * (rules 7, 10 and 50). `label` names the write in the log.
 */
export function writeFont(state: NodeState, start: number, end: number, font: FontName, label: string): void {
  requireFont(state, font, label);
  write(state, label);
  restyle(state, start, end, (style) => withFont(style, font));
}

/**
 * The characters a text shows (rule 34): a sublayer whose main layer links a TEXT property shows the
 * value the nearest instance sets, and otherwise its main layer's, until a designer overrides them.
 */
export function charactersOf(state: NodeState): string {
  const source = state.mirrorOf;
  if (source === undefined || state.overridden.has("characters")) {
    return state.characters;
  }
  const id = rootMain(state).propertyReferences?.characters;
  const instance = nearestInstance(state);
  const value = id === undefined || instance === undefined ? undefined : propertyValue(instance, id);
  return value === undefined || value === true || value === false ? charactersOf(source) : value;
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

/**
 * The style of each character a text shows. A sublayer that shows a TEXT property's characters gives
 * each its first character's style, as written characters take it (rules 10 and 34), unless a write
 * styled each of them (rules 52 and 53).
 */
export function shownStyles(state: NodeState): readonly CharacterStyle[] {
  const shown = charactersOf(state);
  const [first] = state.styles;
  return shown === state.characters ||
    first === undefined ||
    state.styles.length === Math.max(1, shown.length)
    ? state.styles
    : Array.from({ length: Math.max(1, shown.length) }, () => first);
}

/** Give every character a text shows its base style, as a link or a TEXT write does (rules 51, 52). */
export function resetStyles(state: NodeState): void {
  const base = state.baseStyle;
  state.styles = Array.from({ length: Math.max(1, charactersOf(state).length) }, () => base);
}

/** What a segment compares of a character's style: the fields asked for (rule 50). */
export function segmentKey(style: CharacterStyle, fields: readonly string[]): string {
  return JSON.stringify([
    fields.includes("fontName") ? fontKey(style.font) : "",
    fields.includes("fontSize") ? style.fontSize : "",
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

export function fontUnavailable(file: FileState, font: FontNameInput): boolean {
  return file.unavailableFonts.some(
    (missing) =>
      missing.family === font.family && (missing.style === undefined || missing.style === font.style)
  );
}
