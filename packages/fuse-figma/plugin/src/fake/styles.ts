/**
 * Local text styles: `figma.createTextStyle`, `figma.getLocalTextStylesAsync` and the `TextStyle`
 * members the plugin reads and writes.
 *
 * It models this rule. The numbers run across the whole fake, and `fake-figma.ts` lists the module
 * that holds each:
 * 59. A local text style. Probe PT1 ran on a scratch file in the Elmera organization on 2026-11-16,
 *    with a collection of two modes, and showed:
 *    - A new style holds Inter Regular at 12 with an `AUTO` line height.
 *    - Shared plugin data written on a style reads back.
 *    - A description reads back HTML-escaped: `A & B <c> "d" 'e'` read
 *      `A &amp; B &lt;c&gt; &quot;d&quot; &#39;e&#39;`.
 *    - `fontSize`, `lineHeight`, `fontFamily` and `fontWeight` each bind, and the style's own fields
 *      then read the bound values in each collection's first mode.
 *    - A `fontName` write after the bindings drops the `fontWeight` binding and keeps the family,
 *      size and line height bindings.
 *    - A literal `fontSize` write after the binding drops the `fontSize` binding.
 *
 *    PT1 left these open, and the fake assumes them:
 *    - A new style's name is empty and its other fields hold the defaults `createTextStyle` sets
 *      here: no letter spacing, no case, decoration, trim, indent, spacing or hanging, and `AUTO`
 *      wrap. The styles list in the order the file made them, and a removed style throws on every
 *      read but its id. Whether a designer's duplicate of a style copies its plugin data is unknown,
 *      and the fake has no duplicate.
 *    - A `fontName` write needs the new font loaded, and every other type write and binding needs
 *      the style's font loaded, as on a text layer (rule 7). PT1's `fontName` write succeeded
 *      without `loadFontAsync`, but on Inter, which Figma may load itself.
 *    - A family or weight binding sets `fontName` to the font the first modes give, which needs that
 *      font loaded. A null binding unbinds the field and keeps its value.
 *    - A literal `lineHeight` or `letterSpacing` write drops that field's binding, as a `fontSize`
 *      write does.
 */

import { guard } from "./guard.ts";
import { f32, SHARED_DATA_SEPARATOR } from "./state.ts";
import type { FileState, TextStyleState } from "./state.ts";
import { fontLoaded, weightedStyle } from "./text.ts";
import { alias, fileVariable, requireType, resolveNumber, resolveString } from "./variables.ts";

/** What a real file stored each of these characters in a description as (PT1). */
const ESCAPES: readonly (readonly [string, string])[] = [
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
];

function escaped(text: string): string {
  return ESCAPES.reduce((held, [character, escape]) => held.replaceAll(character, escape), text);
}

function logWrite(file: FileState, style: TextStyleState, what: string): void {
  file.writes.push(`${style.id} ${what}`);
}

function requireLoaded(file: FileState, style: TextStyleState, font: FontName, what: string): void {
  if (!fontLoaded(file, font)) {
    throw new Error(
      `Cannot write ${what} of the text style ${style.id} with unloaded font "${font.family} ${font.style}". Please call figma.loadFontAsync(${JSON.stringify(font)}) first.`
    );
  }
}

function liveStyle(style: TextStyleState): TextStyleState {
  if (style.removed) {
    throw new Error(`The style with id ${style.id} does not exist: it was removed.`);
  }
  return style;
}

/** Bind or unbind one field of a style (rule 59). */
function bindStyle(
  file: FileState,
  style: TextStyleState,
  field: VariableBindableTextField,
  variable: Variable | null
): void {
  requireLoaded(file, style, style.font, field);
  if (variable === null) {
    style.bindings.delete(field);
    logWrite(file, style, `unbind ${field}`);
    return;
  }
  const bound = fileVariable(file, variable);
  switch (field) {
    case "fontFamily": {
      requireType(bound, "STRING", field);
      const font = { family: resolveString(file, bound, undefined), style: style.font.style };
      requireLoaded(file, style, font, field);
      style.font = font;
      break;
    }
    case "fontWeight": {
      requireType(bound, "FLOAT", field);
      const font = {
        family: style.font.family,
        style: weightedStyle(style.font, resolveNumber(file, bound, undefined)),
      };
      requireLoaded(file, style, font, field);
      style.font = font;
      break;
    }
    case "fontSize":
      requireType(bound, "FLOAT", field);
      style.fontSize = f32(resolveNumber(file, bound, undefined));
      break;
    case "lineHeight":
      requireType(bound, "FLOAT", field);
      style.lineHeight = { unit: "PIXELS", value: f32(resolveNumber(file, bound, undefined)) };
      break;
    default:
      throw new Error(`The fake Figma file does not model binding ${field} on a text style.`);
  }
  style.bindings.set(field, bound.id);
  logWrite(file, style, `bind ${field}`);
}

/**
 * A type field that takes a literal: it needs the style's font loaded (rule 7), and a write drops
 * the field's binding where it has one (rule 59).
 */
function writeTypeField<Field extends "fontSize" | "lineHeight" | "letterSpacing">(
  file: FileState,
  style: TextStyleState,
  field: Field,
  value: TextStyleState[Field]
): void {
  requireLoaded(file, liveStyle(style), style.font, field);
  style[field] = value;
  style.bindings.delete(field);
  logWrite(file, style, field);
}

/** A field that needs the style's font loaded to write, as every text field does (rule 7). */
type PlainField =
  | "textCase"
  | "textDecoration"
  | "textWrapStyle"
  | "leadingTrim"
  | "paragraphIndent"
  | "paragraphSpacing"
  | "listSpacing"
  | "hangingPunctuation"
  | "hangingList";

function writePlainField<Field extends PlainField>(
  file: FileState,
  style: TextStyleState,
  field: Field,
  value: TextStyleState[Field]
): void {
  requireLoaded(file, liveStyle(style), style.font, field);
  style[field] = value;
  logWrite(file, style, field);
}

/** The `TextStyle` the plugin holds for a style's record. */
function exposeStyle(file: FileState, style: TextStyleState): TextStyle {
  const target = {
    get id(): string {
      return style.id;
    },
    get type(): "TEXT" {
      liveStyle(style);
      return "TEXT";
    },
    get remote(): boolean {
      liveStyle(style);
      return false;
    },
    get name(): string {
      return liveStyle(style).name;
    },
    set name(value: string) {
      liveStyle(style).name = value;
      logWrite(file, style, "name");
    },
    get description(): string {
      return liveStyle(style).description;
    },
    set description(value: string) {
      liveStyle(style).description = escaped(value);
      logWrite(file, style, "description");
    },
    get fontName(): FontName {
      return { ...liveStyle(style).font };
    },
    set fontName(value: FontName) {
      const font = { family: value.family, style: value.style };
      requireLoaded(file, liveStyle(style), font, "fontName");
      style.font = font;
      style.bindings.delete("fontWeight");
      logWrite(file, style, "fontName");
    },
    get fontSize(): number {
      return liveStyle(style).fontSize;
    },
    set fontSize(value: number) {
      writeTypeField(file, style, "fontSize", f32(value));
    },
    get lineHeight(): LineHeight {
      return { ...liveStyle(style).lineHeight };
    },
    set lineHeight(value: LineHeight) {
      writeTypeField(
        file,
        style,
        "lineHeight",
        value.unit === "AUTO" ? { unit: "AUTO" } : { unit: value.unit, value: f32(value.value) }
      );
    },
    get letterSpacing(): LetterSpacing {
      return { ...liveStyle(style).letterSpacing };
    },
    set letterSpacing(value: LetterSpacing) {
      writeTypeField(file, style, "letterSpacing", { unit: value.unit, value: f32(value.value) });
    },
    get textCase(): TextCase {
      return liveStyle(style).textCase;
    },
    set textCase(value: TextCase) {
      writePlainField(file, style, "textCase", value);
    },
    get textDecoration(): TextDecoration {
      return liveStyle(style).textDecoration;
    },
    set textDecoration(value: TextDecoration) {
      writePlainField(file, style, "textDecoration", value);
    },
    get textWrapStyle(): TextWrapStyle {
      return liveStyle(style).textWrapStyle;
    },
    set textWrapStyle(value: TextWrapStyle) {
      writePlainField(file, style, "textWrapStyle", value);
    },
    get leadingTrim(): LeadingTrim {
      return liveStyle(style).leadingTrim;
    },
    set leadingTrim(value: LeadingTrim) {
      writePlainField(file, style, "leadingTrim", value);
    },
    get paragraphIndent(): number {
      return liveStyle(style).paragraphIndent;
    },
    set paragraphIndent(value: number) {
      writePlainField(file, style, "paragraphIndent", value);
    },
    get paragraphSpacing(): number {
      return liveStyle(style).paragraphSpacing;
    },
    set paragraphSpacing(value: number) {
      writePlainField(file, style, "paragraphSpacing", value);
    },
    get listSpacing(): number {
      return liveStyle(style).listSpacing;
    },
    set listSpacing(value: number) {
      writePlainField(file, style, "listSpacing", value);
    },
    get hangingPunctuation(): boolean {
      return liveStyle(style).hangingPunctuation;
    },
    set hangingPunctuation(value: boolean) {
      writePlainField(file, style, "hangingPunctuation", value);
    },
    get hangingList(): boolean {
      return liveStyle(style).hangingList;
    },
    set hangingList(value: boolean) {
      writePlainField(file, style, "hangingList", value);
    },
    get boundVariables(): TextStyle["boundVariables"] {
      const bound: { [field in VariableBindableTextField]?: VariableAlias } = {};
      for (const [field, id] of liveStyle(style).bindings) {
        bound[field] = alias(id);
      }
      return bound;
    },
    setBoundVariable(field: VariableBindableTextField, variable: Variable | null): void {
      bindStyle(file, liveStyle(style), field, variable);
    },
    getSharedPluginData(namespace: string, key: string): string {
      return liveStyle(style).sharedData.get(`${namespace}${SHARED_DATA_SEPARATOR}${key}`) ?? "";
    },
    setSharedPluginData(namespace: string, key: string, value: string): void {
      const entry = `${namespace}${SHARED_DATA_SEPARATOR}${key}`;
      if (value === "") {
        liveStyle(style).sharedData.delete(entry);
      } else {
        liveStyle(style).sharedData.set(entry, value);
      }
      logWrite(file, style, `shared plugin data ${namespace}/${key}`);
    },
    remove(): void {
      liveStyle(style).removed = true;
      logWrite(file, style, "remove");
    },
  };
  // SAFETY: the object models the style members the plugin reads and writes, and the guard throws
  // for every other member.
  return guard(target, "TextStyle") as TextStyle;
}

/**
 * Make a local text style (rule 59).
 *
 * @param file - The file.
 * @returns The new style.
 */
export function createTextStyle(file: FileState): TextStyle {
  const style: TextStyleState = {
    id: `S:${file.nextStyle}`,
    name: "",
    description: "",
    font: { family: "Inter", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    textWrapStyle: "AUTO",
    leadingTrim: "NONE",
    paragraphIndent: 0,
    paragraphSpacing: 0,
    listSpacing: 0,
    hangingPunctuation: false,
    hangingList: false,
    bindings: new Map(),
    sharedData: new Map(),
    removed: false,
  };
  file.nextStyle += 1;
  file.textStyles.push(style);
  logWrite(file, style, "create a text style");
  return exposeStyle(file, style);
}

/**
 * The file's local text styles, in the order the file made them (rule 59).
 *
 * @param file - The file.
 * @returns The styles that were not removed.
 */
export function localTextStyles(file: FileState): TextStyle[] {
  return file.textStyles.filter((style) => !style.removed).map((style) => exposeStyle(file, style));
}
