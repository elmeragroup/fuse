/**
 * This module plans a text layer. It plans the font of the characters outside the glyph ranges, the
 * characters or the TEXT property they link, the typography, the color, and the auto resize,
 * sizing, lengths and truncation.
 */

import type {
  LineHeightSpec,
  NumberSpec,
  TextLayerSpec,
  TextSizingSpec,
} from "../../src/components/kit-spec.ts";
import type { PropertyIds } from "./child-layers.ts";
import {
  changeTogetherIn,
  describeNumber,
  heldSizing,
  LAYOUT_SIZING,
  near,
  planLength,
  planLimit,
  planPaints,
  planScalar,
  SIZING_MEMBERS,
} from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { fontFor, requireFont } from "./fonts.ts";
import { baseCharacters, planGlyphRanges } from "./glyph-font.ts";
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
    change(run.plan, label, `${name} → ${spec.variable.name}`, () => text.setBoundVariable(name, variable));
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
 * @returns Whether the plan replaces the label's font.
 */
function planFont(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  fontName: FontName,
  rewrites: boolean
): boolean {
  // The glyph ranges take the glyph font, so the label's own font holds the other characters.
  const holds =
    text.characters.length > 0
      ? baseCharacters(run, text, rewrites).map((character) => character.font)
      : text.fontName === run.figma.mixed
        ? undefined
        : [text.fontName];
  const differs =
    holds === undefined ||
    holds.some((font) => font.family !== fontName.family || font.style !== fontName.style);
  // The spec sets the style as a literal, and the family too unless it binds one. A variable
  // that any character binds to one of those fields would override the literal in another
  // theme, so the font write clears it in the same operation.
  const literalFields: readonly VariableBindableTextField[] =
    spec.fontFamily.kind === "literal" ? ["fontFamily", ...STYLE_FIELDS] : STYLE_FIELDS;
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
  const replaced = planFont(run, text, label, spec, fontName, writesCharacters(text, spec, propertyIds));
  planScalar(run, label, "name", text.name, spec.name, () => {
    text.name = spec.name;
  });
  planPaints(run, label, "text color", text.fills, spec.color, (paints) => {
    text.fills = paints;
  });

  const typeset = recordsAny(run.plan, () =>
    planTypography(run, text, label, spec, propertyIds, parent, replaced)
  );
  if (!replaced && typeset) {
    for (const font of [...held, fontName]) {
      requireFont(run, label, font);
    }
  }
}

/** Whether a layer's underline offset is the one the spec asks for. */
function offsetMatches(current: TextDecorationOffset | null, desired: TextDecorationOffset): boolean {
  if (current === null || current.unit !== desired.unit) {
    return false;
  }
  return current.unit !== "AUTO" && desired.unit !== "AUTO" ? near(current.value, desired.value) : true;
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
 * Plan the underline as one operation, because Figma holds an underline offset only while the
 * layer is underlined.
 */
function planUnderline(run: Run, text: TextNode, label: string, spec: TextLayerSpec): void {
  const underline = spec.underline;
  if (underline === undefined) {
    if (text.textDecoration !== "NONE") {
      change(run.plan, label, "textDecoration → NONE", () => {
        text.textDecoration = "NONE";
      });
    }
    return;
  }
  const offset: TextDecorationOffset =
    underline.offset === undefined ? { unit: "AUTO" } : { unit: "PIXELS", value: underline.offset };
  const held = text.textDecorationOffset === run.figma.mixed ? null : text.textDecorationOffset;
  if (text.textDecoration === "UNDERLINE" && offsetMatches(held, offset)) {
    return;
  }
  const description = underline.offset === undefined ? "UNDERLINE" : `UNDERLINE, offset ${underline.offset}`;
  change(run.plan, label, `textDecoration → ${description}`, () => {
    text.textDecoration = "UNDERLINE";
    text.textDecorationOffset = offset;
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
 * Plan a text's typography, its characters among them, then the glyph font on its glyph ranges, which
 * a font write or new or linked characters before it reset (G3, G8). A family binding binds only the
 * characters already in the variable's family and changes no font (G10), so it comes after the font
 * write `planFont` plans, and leaves the ranges as they are.
 *
 * @param replaced - Whether the plan writes the label's font first.
 */
function planTypography(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds,
  parent: Held,
  replaced: boolean
): void {
  const rewrites = writesCharacters(text, spec, propertyIds);
  if (spec.fontFamily.kind === "variable") {
    const variable = run.variables.variable(spec.fontFamily.variable);
    if (!bindsFamily(run, text, variable, rewrites)) {
      change(run.plan, label, `fontFamily → ${spec.fontFamily.variable.name}`, () =>
        text.setBoundVariable("fontFamily", variable)
      );
    }
  }
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
  planLineHeight(run, text, label, spec.lineHeight);
  planLetterSpacing(run, text, label, spec);
  planUnderline(run, text, label, spec);
  // A new text hugs its characters, and an empty one is 0 wide, which a fill never widens (PZ), so
  // the characters go in before the layout.
  planCharacters(run, text, label, spec, propertyIds);
  // New or linked characters reset the ranges too (G3), and `planFont` then counts the ranges' glyph
  // font among the label's own, so a text that holds a range gets a font write first.
  planGlyphRanges(run, text, label, spec.characters, spec.fontStyle, replaced);
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
