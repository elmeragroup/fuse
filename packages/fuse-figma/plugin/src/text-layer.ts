/**
 * This module plans a text layer. It plans the font of the characters outside the glyph ranges, the
 * characters or the TEXT property they link, the typography, the color, and the auto resize,
 * sizing, lengths and truncation.
 */

import { PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import type {
  ColorSpec,
  LineHeightSpec,
  NumberSpec,
  TextLayerSpec,
  TextRange,
  TextRangeSpec,
  TextSizingSpec,
  UnderlineSpec,
} from "../../src/components/kit-spec.ts";
import type { PropertyIds } from "./child-layers.ts";
import {
  changeTogetherIn,
  describeColor,
  describeNumber,
  heldSizing,
  LAYOUT_SIZING,
  near,
  paintMatches,
  planLength,
  planLimit,
  planPaints,
  planScalar,
  SIZING_MEMBERS,
  solidPaint,
} from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { fontFor, fontsOf, requireFont } from "./fonts.ts";
import { baseCharacters, labelRuns, planGlyphRanges } from "./glyph-font.ts";
import { change, recordsAny } from "./plan.ts";

/** The text fields that pick a font's style, which the spec sets as a literal. */
const STYLE_FIELDS: readonly VariableBindableTextField[] = ["fontStyle", "fontWeight"];

/**
 * The variable a text field binds across the whole layer. `boundVariables` lists the aliases
 * the characters bind and says nothing of characters that bind none, so the range read is
 * what shows a layer that one character left.
 *
 * @returns The alias when every character binds it, null when no character binds a variable,
 *   or `figma.mixed` when the characters differ.
 */
function textBinding(
  run: Run,
  text: TextNode,
  field: VariableBindableTextField
): VariableAlias | null | PluginAPI["mixed"] {
  if (text.characters.length > 0) {
    return text.getRangeBoundVariable(0, text.characters.length, field);
  }
  // An empty layer has no range to read, so its node-level bindings speak for it.
  const [first, ...rest] = text.boundVariables?.[field] ?? [];
  if (first === undefined) {
    return null;
  }
  return rest.every((alias) => alias.id === first.id) ? first : run.figma.mixed;
}

function planTextNumber(
  run: Run,
  text: TextNode,
  label: string,
  name: "fontSize" | "lineHeight",
  spec: NumberSpec,
  matches: (value: number) => boolean,
  write: (value: number) => void
): void {
  const binding = textBinding(run, text, name);
  if (spec.kind === "variable") {
    const variable = run.variables.variable(spec.variable);
    if (binding !== run.figma.mixed && binding?.id === variable.id) {
      return;
    }
    change(run.plan, label, `${name} → ${spec.variable.name}`, () => {
      text.setBoundVariable(name, variable);
      // A character with a family state of its own takes the value but not the binding (rule 55,
      // FT2), so the text is bound again on any run that still lacks it.
      bindRuns(run, text, name, variable, [{ start: 0, end: text.characters.length }]);
    });
    return;
  }
  if (binding === null && matches(spec.value)) {
    return;
  }
  change(run.plan, label, `${name} → ${describeNumber(spec)}`, () => {
    text.setBoundVariable(name, null);
    write(spec.value);
  });
}

/**
 * Plan the font of the characters outside the glyph ranges, and require the fonts the label's later
 * writes need. A font write comes first
 * among the label's writes, because Figma needs only the new font to set it. Every later write
 * then needs only that font, so a label whose font the machine lacks can still be repaired.
 * A label that keeps its font needs every font it holds for a write such as its size.
 *
 * @param rewrites - Whether the run writes or links the label's characters, which then take the
 *   style of a character a glyph range may hold, so every character counts.
 * @param rebinds - Whether the run binds the label's family, which needs every character in the
 *   label's style first.
 * @returns Whether the plan replaces the label's font.
 */
function planFont(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  fontName: FontName,
  rewrites: boolean,
  rebinds: boolean
): boolean {
  // The glyph ranges take the glyph font, so the label's own font holds the other characters.
  const holds =
    text.characters.length > 0
      ? baseCharacters(run, text, rewrites).map((character) => character.font)
      : text.fontName === run.figma.mixed
        ? undefined
        : [text.fontName];
  // A family binding gives a glyph range with no family state of its own the label's family in the
  // range's own style (FT2), a face the run does not load where that style is not the label's. The
  // font write gives every character the label's style first.
  const restyles =
    rebinds && baseCharacters(run, text, true).some((character) => character.font.style !== fontName.style);
  const differs =
    restyles ||
    holds === undefined ||
    holds.some((font) => font.family !== fontName.family || font.style !== fontName.style);
  // The spec sets the style as a literal, and the family too unless it binds one. A variable
  // that any character binds to one of those fields would override the literal in another
  // theme, so the font write clears it in the same operation.
  // A bound weight keeps its `fontWeight` binding, which `planTypography` writes.
  const styleFields =
    spec.weight === undefined ? STYLE_FIELDS : STYLE_FIELDS.filter((field) => field !== "fontWeight");
  const literalFields: readonly VariableBindableTextField[] =
    spec.fontFamily.kind === "literal" ? ["fontFamily", ...styleFields] : styleFields;
  const unbind = literalFields.filter((field) => textBinding(run, text, field) !== null);
  if (!differs && unbind.length === 0) {
    return false;
  }
  change(run.plan, label, `font → ${fontName.family} ${fontName.style}`, () => {
    for (const field of unbind) {
      text.setBoundVariable(field, null);
    }
    text.fontName = fontName;
  });
  requireFont(run, label, fontName);
  return true;
}

/**
 * Plan a text layer. The font comes first, then the writes that need no font, then the
 * typography. The layer's operations only write, because the run loads every font before its
 * first write.
 *
 * @param held - The fonts the layer holds now. A layer the run creates passes none, because
 *   its first font is unknown until it exists, and the font write that a new layer gets
 *   needs only the new font.
 * @param parent - `unknown` when the box that holds the layer turns in this run.
 */
export function planText(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds,
  held: readonly FontName[],
  parent: Held
): void {
  const fontName = fontFor(run, text, spec);
  // A bound weight can show any face it names, in each family the layer's characters take.
  if (spec.weight !== undefined) {
    for (const font of fontsOf(run, spec, fontName.family)) {
      requireFont(run, label, font);
    }
  }
  const rewrites = writesCharacters(text, spec, propertyIds);
  const family = spec.fontFamily;
  const rebinds =
    family.kind === "variable" && !bindsFamily(run, text, run.variables.variable(family.variable), rewrites);
  const replaced = planFont(run, text, label, spec, fontName, rewrites, rebinds);
  planScalar(run, label, "name", text.name, spec.name, () => {
    text.name = spec.name;
  });
  const ranged = rangesOf(text, spec);
  if (ranged === undefined) {
    planPaints(run, label, "text color", text.fills, spec.color, (paints) => {
      text.fills = paints;
    });
  }

  const typeset = recordsAny(run.plan, () =>
    planTypography(run, text, label, spec, propertyIds, parent, replaced, ranged)
  );
  if (ranged !== undefined) {
    // A font write leaves the label in the new font alone, so a repair of a font Figma cannot load
    // needs only the new one. The glyph ranges' writes load their own.
    planRanges(
      run,
      text,
      label,
      spec,
      ranged,
      replaced || typeset,
      replaced ? [fontName] : [...held, fontName]
    );
  }
  if (!replaced && typeset) {
    for (const font of [...held, fontName]) {
      requireFont(run, label, font);
    }
  }
}

/**
 * The shared plugin data key of a label whose links the plugin wrote, so a later spec that links no
 * range still clears them.
 */
const LINKS_KEY = "links";

/** The value `LINKS_KEY` holds on a label whose links the plugin owns. */
const OWNED_LINKS = "owned";

/**
 * Who owns a label's links: the plugin, for a label whose spec links a range or whose links the
 * plugin wrote before, or the designer, whose links the plugin leaves as they are.
 */
type LinkOwner = "plugin" | "designer";

/** A text the plan styles run by run: its ranges, none for one it only unlinks, and its links' owner. */
type RangedText = { readonly ranges: readonly TextRangeSpec[]; readonly links: LinkOwner };

/**
 * How the plan styles a text's characters: run by run where the spec gives ranges or the plugin
 * linked the label before, or undefined for a text the whole-text writes style.
 */
function rangesOf(text: TextNode, spec: TextLayerSpec): RangedText | undefined {
  const linked =
    spec.ranges?.some((range) => range.hyperlink !== undefined) === true ||
    text.getSharedPluginData(PLUGIN_DATA_NAMESPACE, LINKS_KEY) === OWNED_LINKS;
  const links: LinkOwner = linked ? "plugin" : "designer";
  if (spec.ranges === undefined) {
    return linked ? { ranges: [], links } : undefined;
  }
  return { ranges: spec.ranges, links };
}

/** The line a character draws: none, a line through it, or an underline. */
type CharacterLine =
  | { readonly kind: "NONE" }
  | { readonly kind: "STRIKETHROUGH" }
  | { readonly kind: "UNDERLINE"; readonly underline: UnderlineSpec };

/** The line a text's characters draw outside its ranges. */
function labelLine(spec: Pick<TextLayerSpec, "underline" | "strikethrough">): CharacterLine {
  if (spec.underline !== undefined) {
    return { kind: "UNDERLINE", underline: spec.underline };
  }
  return spec.strikethrough === true ? { kind: "STRIKETHROUGH" } : { kind: "NONE" };
}

/** Whether a segment of a text draws the line the spec asks of its characters. */
function lineMatches(
  run: Run,
  segment: Pick<
    StyledTextSegment,
    "textDecoration" | "textDecorationOffset" | "textDecorationThickness" | "textDecorationColor"
  >,
  line: CharacterLine
): boolean {
  if (line.kind !== "UNDERLINE") {
    return segment.textDecoration === line.kind;
  }
  return (
    segment.textDecoration === "UNDERLINE" &&
    decorationMatches(segment.textDecorationOffset, pixelsOrAuto(line.underline.offset)) &&
    decorationMatches(segment.textDecorationThickness, pixelsOrAuto(line.underline.thickness)) &&
    decorationColorMatches(run, segment.textDecorationColor, line.underline.color)
  );
}

/** An underline's fields as a plan line names them, beside `UNDERLINE`. */
function describeUnderline(underline: UnderlineSpec): string {
  return [
    "UNDERLINE",
    ...(underline.offset === undefined ? [] : [`offset ${underline.offset}`]),
    ...(underline.thickness === undefined ? [] : [`thickness ${underline.thickness}`]),
    ...(underline.color === undefined ? [] : [`color ${describeColor(underline.color)}`]),
  ].join(", ");
}

/** An underline's color as Figma holds it: `AUTO`, the text's own fill, for an unset one. */
function underlineColor(run: Run, underline: UnderlineSpec): TextDecorationColor {
  return underline.color === undefined ? { value: "AUTO" } : { value: solidPaint(run, underline.color) };
}

/**
 * Plan a text whose characters take colors, underlines or links of their own: the text's color, line
 * and no link, then each range's, through `setRangeFills` with a paint bound by
 * `setBoundVariableForPaint`, as the typings say a range's fills bind, `setRangeHyperlink`, and
 * `setRangeTextDecoration` with its underline fields. On 2026-11-19 a real file's whole `fills` write
 * reset the ranges' fills, and a `characters` write, even of the same text, gave every character the
 * first character's fill, while `fontSize` and `fontName` writes kept them. On 2026-11-21 range
 * decorations and links did the same (RD2, RD3, RH4, RH5), and a whole NONE cleared every range's
 * line while each character kept its underline fields for its next underline (RD4, RD4b). So the
 * ranges go after every other write of the label, each underlined range writes all four of its
 * fields, and a label any earlier operation of the run writes takes them all again, which costs one
 * operation on a label the run already changes. The plan reads no underline style, so a designer's
 * dotted underline stays.
 *
 * The plan reads and writes the links of a label the plugin owns, and marks it in shared plugin
 * data, so a later spec that links no range still clears them. It leaves the links of any other
 * label alone, so a designer's link on a Code token stays.
 *
 * @param ranged - The ranges and who owns the label's links.
 * @param rewritten - Whether the run writes the label's font, characters or type before this.
 * @param fonts - The fonts the label holds once the run's font write, if any, has run, which a range
 *   write needs loaded. A label whose font the run replaces holds only the new one.
 */
function planRanges(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  ranged: RangedText,
  rewritten: boolean,
  fonts: readonly FontName[]
): void {
  const { ranges, links } = ranged;
  const owned = links === "plugin";
  const linked = ranges.some((range) => range.hyperlink !== undefined);
  const own = labelLine(spec);
  const looks: {
    readonly color: ColorSpec;
    readonly line: CharacterLine;
    readonly hyperlink: string | undefined;
  }[] = Array.from({ length: spec.characters.length }, () => ({
    color: spec.color,
    line: own,
    hyperlink: undefined,
  }));
  for (const range of ranges) {
    const line: CharacterLine =
      range.underline === undefined ? own : { kind: "UNDERLINE", underline: range.underline };
    looks.fill({ color: range.color, line, hyperlink: range.hyperlink }, range.start, range.end);
  }
  const marked = text.getSharedPluginData(PLUGIN_DATA_NAMESPACE, LINKS_KEY) === OWNED_LINKS;
  const shown =
    !rewritten &&
    marked === linked &&
    text.characters === spec.characters &&
    text
      .getStyledTextSegments([
        "fills",
        "textDecoration",
        "textDecorationOffset",
        "textDecorationThickness",
        "textDecorationColor",
        "hyperlink",
      ])
      .every((segment) => {
        const [paint, ...rest] = segment.fills;
        return (
          paint !== undefined &&
          rest.length === 0 &&
          looks
            .slice(segment.start, segment.end)
            .every(
              (look) =>
                paintMatches(run, paint, look.color) &&
                lineMatches(run, segment, look.line) &&
                (!owned || linkMatches(segment.hyperlink, look.hyperlink))
            )
        );
      });
  if (shown) {
    return;
  }
  const described = ranges.map((range) =>
    [
      `${range.start}-${range.end} ${describeColor(range.color)}`,
      ...(range.underline === undefined ? [] : [describeUnderline(range.underline)]),
      ...(range.hyperlink === undefined ? [] : [`link ${range.hyperlink}`]),
    ].join(" ")
  );
  const line = own.kind === "UNDERLINE" ? describeUnderline(own.underline) : own.kind;
  const head = [`text color → ${describeColor(spec.color)}`, ...(own.kind === "NONE" ? [] : [line])];
  const unlinked = owned && !linked ? ["no links"] : [];
  change(run.plan, label, [head.join(" "), ...described, ...unlinked].join(", "), () => {
    text.fills = [solidPaint(run, spec.color)];
    // A whole decoration write gives every character the text's line, which the ranges then change.
    text.textDecoration = own.kind;
    if (own.kind === "UNDERLINE") {
      text.textDecorationOffset = pixelsOrAuto(own.underline.offset);
      text.textDecorationThickness = pixelsOrAuto(own.underline.thickness);
      text.textDecorationColor = underlineColor(run, own.underline);
    }
    if (owned) {
      // A whole null clears every range's link, which fills and decoration writes keep (RH4, RH6).
      text.hyperlink = null;
      text.setSharedPluginData(PLUGIN_DATA_NAMESPACE, LINKS_KEY, linked ? OWNED_LINKS : "");
    }
    for (const range of ranges) {
      text.setRangeFills(range.start, range.end, [solidPaint(run, range.color)]);
      if (range.hyperlink !== undefined) {
        text.setRangeHyperlink(range.start, range.end, { type: "URL", value: range.hyperlink });
      }
      if (range.underline !== undefined) {
        text.setRangeTextDecoration(range.start, range.end, "UNDERLINE");
        text.setRangeTextDecorationOffset(range.start, range.end, pixelsOrAuto(range.underline.offset));
        text.setRangeTextDecorationThickness(range.start, range.end, pixelsOrAuto(range.underline.thickness));
        text.setRangeTextDecorationColor(range.start, range.end, underlineColor(run, range.underline));
      }
    }
  });
  for (const font of fonts) {
    requireFont(run, label, font);
  }
}

/** Whether a segment's link is the URL the spec gives its characters, or none where it gives none. */
function linkMatches(held: HyperlinkTarget | null, url: string | undefined): boolean {
  return url === undefined ? held === null : held?.type === "URL" && held.value === url;
}

/** An underline offset or thickness in pixels, or Figma's automatic one for an unset length. */
function pixelsOrAuto(px: number | undefined): TextDecorationOffset {
  return px === undefined ? { unit: "AUTO" } : { unit: "PIXELS", value: px };
}

/** A field a text holds across all its characters, or null where some characters differ. */
function unmixed<Value>(run: Run, value: Value | PluginAPI["mixed"]): Value | null {
  return value === run.figma.mixed ? null : value;
}

/** Whether a layer's underline offset or thickness is the one the spec asks for. */
function decorationMatches(
  current: TextDecorationOffset | TextDecorationThickness | null,
  desired: TextDecorationOffset | TextDecorationThickness
): boolean {
  if (current === null || current.unit !== desired.unit) {
    return false;
  }
  return current.unit !== "AUTO" && desired.unit !== "AUTO" ? near(current.value, desired.value) : true;
}

/** Whether a layer's underline color is the one the spec asks for, `AUTO` for an unset one. */
function decorationColorMatches(
  run: Run,
  current: TextDecorationColor | null,
  desired: ColorSpec | undefined
): boolean {
  if (current === null) {
    return false;
  }
  return desired === undefined
    ? current.value === "AUTO"
    : current.value !== "AUTO" && paintMatches(run, current.value, desired);
}

/**
 * Plan a text's line height: in pixels or bound to a variable as a number field, or a percent of the
 * font size, which follows a font size a variable sets per mode, as a real file did on 2026-10-23
 * (PH). A percent clears a binding the layer held.
 */
function planLineHeight(run: Run, text: TextNode, label: string, spec: LineHeightSpec): void {
  if (spec.kind !== "percent") {
    planTextNumber(
      run,
      text,
      label,
      "lineHeight",
      spec,
      (value) =>
        text.lineHeight !== run.figma.mixed &&
        text.lineHeight.unit === "PIXELS" &&
        near(text.lineHeight.value, value),
      (value) => {
        text.lineHeight = { unit: "PIXELS", value };
      }
    );
    return;
  }
  const held = text.lineHeight;
  if (
    textBinding(run, text, "lineHeight") === null &&
    held !== run.figma.mixed &&
    held.unit === "PERCENT" &&
    near(held.value, spec.value)
  ) {
    return;
  }
  change(run.plan, label, `lineHeight → ${spec.value}%`, () => {
    text.setBoundVariable("lineHeight", null);
    text.lineHeight = { unit: "PERCENT", value: spec.value };
  });
}

/**
 * Plan a label's letter spacing, a percent of its font size (PL). A label the spec gives no spacing
 * plans none, so a published label keeps whatever spacing it holds.
 */
function planLetterSpacing(run: Run, text: TextNode, label: string, spec: TextLayerSpec): void {
  const desired = spec.letterSpacing;
  const held = text.letterSpacing;
  if (
    desired === undefined ||
    (held !== run.figma.mixed && held.unit === desired.unit && near(held.value, desired.value))
  ) {
    return;
  }
  change(run.plan, label, `letterSpacing → ${desired.value}%`, () => {
    text.letterSpacing = { unit: desired.unit, value: desired.value };
  });
}

/**
 * Plan the text's decoration as one operation, because Figma holds an underline offset, thickness
 * and color only while the layer is underlined. An unset color writes `AUTO`, the text's own fill. A
 * line through the text takes none of them, and draws in the text's own fill.
 *
 * @param held - `unknown` when an earlier operation of the run links the text's style, which may
 *   reset the decoration, so the operation writes it whatever the text reads now.
 */
export function planDecoration(
  run: Run,
  text: TextNode,
  label: string,
  spec: Pick<TextLayerSpec, "underline" | "strikethrough">,
  held: "read" | "unknown"
): void {
  const underline = spec.underline;
  const reads = held === "read";
  if (underline === undefined) {
    const decoration = spec.strikethrough === true ? "STRIKETHROUGH" : "NONE";
    if (!reads || text.textDecoration !== decoration) {
      change(run.plan, label, `textDecoration → ${decoration}`, () => {
        text.textDecoration = decoration;
      });
    }
    return;
  }
  const offset = pixelsOrAuto(underline.offset);
  const thickness = pixelsOrAuto(underline.thickness);
  const heldOffset = unmixed(run, text.textDecorationOffset);
  const heldThickness = unmixed(run, text.textDecorationThickness);
  const heldColor = unmixed(run, text.textDecorationColor);
  if (
    reads &&
    text.textDecoration === "UNDERLINE" &&
    decorationMatches(heldOffset, offset) &&
    decorationMatches(heldThickness, thickness) &&
    decorationColorMatches(run, heldColor, underline.color)
  ) {
    return;
  }
  const color = underlineColor(run, underline);
  change(run.plan, label, `textDecoration → ${describeUnderline(underline)}`, () => {
    text.textDecoration = "UNDERLINE";
    text.textDecorationOffset = offset;
    text.textDecorationThickness = thickness;
    text.textDecorationColor = color;
  });
}

/**
 * The auto resize a text's sizing takes: both sides hug its characters, its width is set and its
 * height follows its lines, or both sides are fixed.
 */
function autoResizeOf(sizing: TextSizingSpec): "WIDTH_AND_HEIGHT" | "HEIGHT" | "NONE" {
  if (sizing.vertical.kind === "fixed") {
    return "NONE";
  }
  return sizing.horizontal.kind === "hug" ? "WIDTH_AND_HEIGHT" : "HEIGHT";
}

/**
 * Plan how a text sizes and truncates as one operation, in the order its writes depend on each
 * other. The auto resize comes first, since it moves the text's hug: on a real file on 2026-10-22
 * a fill across a hugging text turned it to a fixed width with an auto height (P3). A filling text
 * that reads less than a pixel wide, and that the spec gives characters, gets a 1px width next,
 * since a fill never widens a 0-wide text and any positive width lets it take over (PZ). The sizing
 * on each axis follows, then a fixed width or height, which the auto resize must already keep, then
 * the truncation, and last the maximum lines, which a text keeps only while it truncates (P4).
 *
 * @param held - `unknown` when the text's box turns in this run, which moves its fill to the other
 *   axis, so the operation writes its sizing and lengths whatever it reads now, as it does after a
 *   new auto resize.
 */
function planTextLayout(run: Run, text: TextNode, label: string, spec: TextLayerSpec, held: Held): void {
  const autoResize = autoResizeOf(spec.sizing);
  const sizing = {
    horizontal: LAYOUT_SIZING[spec.sizing.horizontal.kind],
    vertical: LAYOUT_SIZING[spec.sizing.vertical.kind],
  };
  const truncation = spec.truncation === undefined ? "DISABLED" : "ENDING";
  changeTogetherIn(run, label, (group) => {
    // A text that fills across but reads less than a pixel wide stays so whatever FILL and
    // characters it gets, until a positive width lets the fill take over (PZ), as an earlier run
    // that laid a new text out before its characters left every filling text. The run leaves the
    // text holding the spec's characters, which `planCharacters` writes or links before this, so
    // they decide, whatever it holds now, and a text the spec leaves empty gets no width.
    const stuck = spec.sizing.horizontal.kind === "fill" && text.width < 1 && spec.characters.length > 0;
    // A new auto resize moves the text's hug, and a hugging text's size follows its characters and
    // its font, which the run can change first, so the sizing and the lengths after a new auto
    // resize, or after the repair, are written whatever the text reads now.
    const lengths: Held =
      !stuck && held === "read" && text.textAutoResize === autoResize ? "read" : "unknown";
    const reads = lengths === "read" ? heldSizing(text) : undefined;
    planScalar(group, label, "textAutoResize", text.textAutoResize, autoResize, () => {
      text.textAutoResize = autoResize;
    });
    if (stuck) {
      change(group.plan, label, "width → 1 for the fill to take over", () => text.resize(1, text.height));
    }
    for (const [axis, member] of SIZING_MEMBERS) {
      if (reads?.[axis] !== sizing[axis]) {
        change(group.plan, label, `${member} → ${sizing[axis]}`, () => {
          text[member] = sizing[axis];
        });
      }
    }
    planLength(group, text, label, "width", spec.sizing.horizontal, lengths, (value) =>
      text.resize(value, text.height)
    );
    planLength(group, text, label, "height", spec.sizing.vertical, lengths, (value) =>
      text.resize(text.width, value)
    );
    planLimit(group, text, label, "maxWidth", spec.maxWidth);
    planScalar(group, label, "textTruncation", text.textTruncation, truncation, () => {
      text.textTruncation = truncation;
    });
    const maxLines = spec.truncation?.maxLines;
    if (maxLines !== undefined && (text.textTruncation !== truncation || text.maxLines !== maxLines)) {
      change(group.plan, label, `maxLines → ${maxLines}`, () => {
        text.maxLines = maxLines;
      });
    }
  });
}

/**
 * Whether a text's family binds the variable. The glyph ranges bind none (G2), so the other
 * characters say, or an empty text's node-level binding.
 */
function bindsFamily(run: Run, text: TextNode, variable: Variable, rewrites: boolean): boolean {
  if (text.characters.length > 0) {
    return baseCharacters(run, text, rewrites).every((character) => character.family === variable.id);
  }
  const binding = textBinding(run, text, "fontFamily");
  return binding !== run.figma.mixed && binding?.id === variable.id;
}

/**
 * Plan the glyph font on a label's glyph ranges, in the face its bound weight names in the label's
 * modes as the rest of it takes, and then its weight binding. A weight binding gives every character
 * the face its family names for the weight in the label's modes, the face the font writes give it, so
 * it changes no font the run did not load (rule 10). A `fontName` write drops it (PG8), and so does a
 * range font write on its range (FT3), so a label whose font or glyph ranges the run writes binds it
 * again, after the characters and glyph ranges and before the layout, which the face it shows sizes. A
 * whole-text binding written after the ranges binds every range, a glyph range in the glyph font's
 * family included (PG13). A label an instance shows takes the same, after a TEXT write on the
 * instance resets it (G5).
 *
 * @param characters - The characters the label shows once the run's earlier operations have run.
 * @param rewritten - Whether an earlier operation of the run writes the font of every character or
 *   binds the label's family.
 */
export function planGlyphFaces(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  characters: string,
  rewritten: boolean
): void {
  const refonted = recordsAny(run.plan, () =>
    planGlyphRanges(run, text, label, characters, fontFor(run, text, spec).style, rewritten)
  );
  if (spec.weight === undefined) {
    return;
  }
  const variable = run.variables.variable(spec.weight.variable);
  const binding = textBinding(run, text, "fontWeight");
  if (rewritten || refonted || binding === run.figma.mixed || binding?.id !== variable.id) {
    change(run.plan, label, `fontWeight → ${spec.weight.variable.name}`, () =>
      text.setBoundVariable("fontWeight", variable)
    );
  }
}

/**
 * Plan the label's family binding where a character it keeps does not bind the variable, and bind
 * on its own each run outside the glyph ranges that the whole binding leaves as it was.
 *
 * @returns Whether the plan binds it.
 */
function planFamily(
  run: Run,
  text: TextNode,
  label: string,
  family: Extract<TextLayerSpec["fontFamily"], { readonly kind: "variable" }>,
  rewrites: boolean
): boolean {
  const variable = run.variables.variable(family.variable);
  if (bindsFamily(run, text, variable, rewrites)) {
    return false;
  }
  change(run.plan, label, `fontFamily → ${family.variable.name}`, () => {
    text.setBoundVariable("fontFamily", variable);
    // A character with a family state of its own keeps its font and its binding or none through the
    // whole binding (FT6, FT7), so each run outside the glyph ranges is bound again where it lacks it.
    bindRuns(run, text, "fontFamily", variable, labelRuns(run, text.characters));
  });
  return true;
}

/**
 * Bind a text field on each range that still binds no variable or another one after a whole binding,
 * as the text reads when the operation runs.
 *
 * @param ranges - The ranges to bind, each as one run.
 */
function bindRuns(
  run: Run,
  text: TextNode,
  field: VariableBindableTextField,
  variable: Variable,
  ranges: readonly TextRange[]
): void {
  for (const range of ranges.filter((each) => each.end > each.start)) {
    const bound = text.getRangeBoundVariable(range.start, range.end, field);
    if (bound === run.figma.mixed || bound?.id !== variable.id) {
      text.setRangeBoundVariable(range.start, range.end, field, variable);
    }
  }
}

/**
 * Plan a text's typography, its characters among them, then the glyph font on its glyph ranges, which
 * a font write or new or linked characters before it reset (G3, G8). A family binding gives every
 * character the variable's family and binds it, apart from a character with a family state of its
 * own: a range family binding set it, or a range font write or a null range binding dropped its
 * binding, and every character does not yet hold one style (G10, FT2, FT6, FT7). So the family, size
 * and line height bindings come after the characters. A whole Roboto write over `⌘K` leaves `⌘`
 * unbound and `K` bound, and `⌘` keeps its state. Writing `⌘B` then gives both characters `⌘`'s
 * unbound style and clears the state, and the binding after it binds both (FT1, FT6). Bound before the
 * characters, it would skip `⌘`, whose unbound style `B` would then take. A family binding can give
 * the label's family to a glyph range that holds no state, so the run writes every glyph range again
 * after one. A character with a state of its own keeps its family through a whole binding and takes
 * a size or line height without the binding, so `bindRuns` binds such runs on their own after each
 * whole binding, and `planFont` gives every character the label's style first where a glyph range
 * holds another.
 *
 * @param replaced - Whether the plan writes the label's font first.
 * @param ranged - The ranges of a text the plan styles run by run, which take its line, or undefined.
 */
function planTypography(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds,
  parent: Held,
  replaced: boolean,
  ranged: RangedText | undefined
): void {
  const rewrites = writesCharacters(text, spec, propertyIds);
  const planSize = (): void =>
    planTextNumber(
      run,
      text,
      label,
      "fontSize",
      spec.fontSize,
      (value) => text.fontSize !== run.figma.mixed && near(text.fontSize, value),
      (value) => {
        text.fontSize = value;
      }
    );
  // A literal size or line height goes in before the characters, which a new text hugs at it.
  if (spec.fontSize.kind !== "variable") {
    planSize();
  }
  if (spec.lineHeight.kind !== "variable") {
    planLineHeight(run, text, label, spec.lineHeight);
  }
  planLetterSpacing(run, text, label, spec);
  // A text with ranges takes its line with them, after every other write (`planRanges`).
  if (ranged === undefined) {
    planDecoration(run, text, label, spec, "read");
  }
  // A new text hugs its characters, and an empty one is 0 wide, which a fill never widens (PZ), so
  // the characters go in before the layout.
  planCharacters(run, text, label, spec, propertyIds);
  const bindsLabelFamily =
    spec.fontFamily.kind === "variable" && planFamily(run, text, label, spec.fontFamily, rewrites);
  if (spec.fontSize.kind === "variable") {
    planSize();
  }
  if (spec.lineHeight.kind === "variable") {
    planLineHeight(run, text, label, spec.lineHeight);
  }
  // New or linked characters reset the ranges too (G3), and `planFont` then counts the ranges' glyph
  // font among the label's own, so a text that holds a range gets a font write first. A family
  // binding can give a glyph range the label's family, so the ranges go on again after one.
  planGlyphFaces(run, text, label, spec, spec.characters, replaced || bindsLabelFamily);
  planTextLayout(run, text, label, spec, parent);
  const { horizontal, vertical } = spec.align;
  planScalar(run, label, "textAlignHorizontal", text.textAlignHorizontal, horizontal, () => {
    text.textAlignHorizontal = horizontal;
  });
  planScalar(run, label, "textAlignVertical", text.textAlignVertical, vertical, () => {
    text.textAlignVertical = vertical;
  });
}

/** Whether the plan writes a text's characters, or links them to the set's TEXT property. */
function writesCharacters(text: TextNode, spec: TextLayerSpec, propertyIds: PropertyIds): boolean {
  if (spec.textProperty === undefined) {
    return text.characters !== spec.characters;
  }
  const linked = propertyIds.get(spec.textProperty);
  return linked === undefined || text.componentPropertyReferences?.characters !== linked;
}

/** Plan a text's characters, or the TEXT property of the set that sets them. */
function planCharacters(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds
): void {
  const property = spec.textProperty;
  if (property === undefined) {
    planScalar(run, label, "characters", text.characters, spec.characters, () => {
      text.characters = spec.characters;
    });
    return;
  }
  if (!writesCharacters(text, spec, propertyIds)) {
    return;
  }
  change(run.plan, label, `characters → the ${property} property`, () => {
    const propertyId = propertyIds.get(property);
    if (propertyId === undefined) {
      throw new Error(`${label}: the ${property} property has no id when the layer links to it.`);
    }
    text.characters = spec.characters;
    text.componentPropertyReferences = { characters: propertyId };
  });
}
