/**
 * Plan the kit's local text styles. The REST API that `figma:sync` writes through cannot create a
 * style, so the plugin keeps them, as it keeps the kit's nodes, and finds them through the same
 * identity rules in `identity.ts`: a key in shared plugin data, which a real file kept on a style
 * (PT1), a name match once for a style without a key, and a delete only for a keyed style the kit
 * dropped.
 *
 * The plugin owns every field a text style applies. The spec gives the font, size, line height,
 * letter spacing, case, decoration and wrap from the recipe, and the plugin holds the rest at
 * Figma's defaults, so a style a designer named like a kit style draws the kit's type once adopted.
 *
 * A bound field reads the collection's first mode on the style, and a layer that uses the style
 * reads it in its frame's modes (PT1). So the plan compares a bound field by its binding alone, and
 * a field's value only where the field binds nothing. When any of the style's type differs, one
 * operation writes all of it again, in the order PT1 allows: a `fontName` write drops a weight
 * binding and a literal size write drops a size binding, so the font and the literal fields come
 * first and the bindings last.
 *
 * The write sets the font the family and weight give in each collection's first mode, and the run
 * requires that font before its first write, so a font this machine cannot load stops the run with
 * nothing written. A font only another mode gives is not required: a frame that pins that mode shows
 * it as missing where the machine lacks it, as it does for a kit label.
 */

import { Effect } from "effect";

import { FONT_WEIGHT_STYLES, TEXT_STYLE_KEY_PREFIX } from "../../src/components/kit-spec.ts";
import type { LineHeightSpec, TextStyleSpec, VariableRef } from "../../src/components/kit-spec.ts";
import { FileNotSynced } from "./errors.ts";
import { describeNumber, near } from "./fields.ts";
import type { Run } from "./fields.ts";
import { requireFont, resolveOnPage } from "./fonts.ts";
import { findOwned, indexSiblings, keyOf, setKey, staleOwned } from "./identity.ts";
import { change, existing } from "./plan.ts";
import type { Target } from "./plan.ts";
import { currentRun } from "./services.ts";

/** The label of the change lines that add or remove a style. */
const LABEL = "Text styles";

/**
 * The fields a style applies that no Fuse recipe sets, at Figma's defaults for a new style. The
 * typings list them on `TextStyle`, and no probe has read a new style's values for them.
 */
const DEFAULTS = {
  leadingTrim: "NONE",
  paragraphIndent: 0,
  paragraphSpacing: 0,
  listSpacing: 0,
  hangingPunctuation: false,
  hangingList: false,
} as const;

/** What a real file stored each of these characters in a style's description as (PT1). */
const ESCAPES: readonly (readonly [string, string])[] = [
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&amp;", "&"],
];

/** A description as it was written, with the escapes a real file stores undone. */
function unescaped(description: string): string {
  return ESCAPES.reduce((text, [escaped, character]) => text.replaceAll(escaped, character), description);
}

/** Accepts any match: the walk reads local text styles alone, so every keyed one is a text style. */
function isTextStyle(_style: TextStyle): _style is TextStyle {
  return true;
}

/** The id of the variable a style's field binds, or undefined for a field that binds none. */
function boundId(style: TextStyle, field: VariableBindableTextField): string | undefined {
  return style.boundVariables?.[field]?.id;
}

/** The Figma style of a weight a variable holds. */
function weightStyle(spec: TextStyleSpec, ref: VariableRef, weight: number) {
  const style = FONT_WEIGHT_STYLES.get(weight);
  return style === undefined
    ? Effect.fail(
        new FileNotSynced({
          message: `${spec.name}: ${ref.name} holds ${String(weight)}, which names no font style the kit knows.`,
          collection: ref.collection,
        })
      )
    : Effect.succeed(style);
}

/**
 * The font a style's write sets and its bindings then pick: its family and weight, each a literal or
 * what its variable holds in each collection's first mode, which a style reads its bindings in (PT1).
 * A frame that pins another mode may show another font, such as Neo Sans in a branded Fjordkraft
 * frame. The run does not need that font, and Figma shows it as missing where the machine lacks it,
 * as it does for a kit label.
 */
const fontOf = Effect.fnUntraced(function* (run: Run, spec: TextStyleSpec) {
  const { fontFamily, fontWeight } = spec;
  let family = fontFamily.kind === "literal" ? fontFamily.value : "";
  if (fontFamily.kind === "variable") {
    const value = yield* resolveOnPage(run.figma, run.variables.variable(fontFamily.variable), {});
    // SAFETY: the kit check confirmed the family variable is a STRING variable, and an alias keeps
    // its variable's type, so its value is a string.
    family = value as string;
  }
  let style = fontWeight.kind === "literal" ? fontWeight.style : "";
  if (fontWeight.kind === "variable") {
    const value = yield* resolveOnPage(run.figma, run.variables.variable(fontWeight.variable), {});
    // SAFETY: the kit check confirmed the weight variable is a FLOAT variable, and an alias keeps its
    // variable's type, so its value is a number.
    style = yield* weightStyle(spec, fontWeight.variable, value as number);
  }
  const font: FontName = { family, style };
  return font;
});

function describeLineHeight(spec: LineHeightSpec): string {
  return spec.kind === "percent" ? `${spec.value}%` : describeNumber(spec);
}

/** Whether the line height holds the spec: its variable, or the literal pixels or percent with no binding. */
function lineHeightMatches(run: Run, style: TextStyle, spec: LineHeightSpec): boolean {
  if (spec.kind === "variable") {
    return boundId(style, "lineHeight") === run.variables.variable(spec.variable).id;
  }
  const held = style.lineHeight;
  const unit = spec.kind === "percent" ? "PERCENT" : "PIXELS";
  return (
    boundId(style, "lineHeight") === undefined &&
    held.unit !== "AUTO" &&
    held.unit === unit &&
    near(held.value, spec.value)
  );
}

/** The fields of a style that differ from the spec and Figma's defaults, as change descriptions. */
function typeDrift(run: Run, style: TextStyle, spec: TextStyleSpec, font: FontName): string[] {
  const drift: string[] = [];
  const { fontFamily, fontWeight, fontSize, letterSpacing } = spec;
  const variableId = (ref: VariableRef) => run.variables.variable(ref).id;
  const familyMatches =
    fontFamily.kind === "variable"
      ? boundId(style, "fontFamily") === variableId(fontFamily.variable)
      : boundId(style, "fontFamily") === undefined && style.fontName.family === fontFamily.value;
  if (!familyMatches) {
    drift.push(
      `fontFamily → ${fontFamily.kind === "variable" ? fontFamily.variable.name : fontFamily.value}`
    );
  }
  const weightMatches =
    boundId(style, "fontStyle") === undefined &&
    (fontWeight.kind === "variable"
      ? boundId(style, "fontWeight") === variableId(fontWeight.variable)
      : boundId(style, "fontWeight") === undefined && style.fontName.style === font.style);
  if (!weightMatches) {
    drift.push(
      `fontWeight → ${fontWeight.kind === "variable" ? fontWeight.variable.name : fontWeight.style}`
    );
  }
  const sizeMatches =
    fontSize.kind === "variable"
      ? boundId(style, "fontSize") === variableId(fontSize.variable)
      : boundId(style, "fontSize") === undefined && near(style.fontSize, fontSize.value);
  if (!sizeMatches) {
    drift.push(`fontSize → ${describeNumber(fontSize)}`);
  }
  if (!lineHeightMatches(run, style, spec.lineHeight)) {
    drift.push(`lineHeight → ${describeLineHeight(spec.lineHeight)}`);
  }
  const spacing = style.letterSpacing;
  if (
    boundId(style, "letterSpacing") !== undefined ||
    spacing.unit !== letterSpacing.unit ||
    !near(spacing.value, letterSpacing.value)
  ) {
    drift.push(`letterSpacing → ${letterSpacing.value}%`);
  }
  for (const field of ["textCase", "textDecoration", "textWrapStyle"] as const) {
    if (style[field] !== spec[field]) {
      drift.push(`${field} → ${spec[field]}`);
    }
  }
  for (const field of ["paragraphIndent", "paragraphSpacing"] as const) {
    if (boundId(style, field) !== undefined || style[field] !== DEFAULTS[field]) {
      drift.push(`${field} → ${DEFAULTS[field]}`);
    }
  }
  for (const field of ["leadingTrim", "listSpacing", "hangingPunctuation", "hangingList"] as const) {
    if (style[field] !== DEFAULTS[field]) {
      drift.push(`${field} → ${String(DEFAULTS[field])}`);
    }
  }
  return drift;
}

/** A field a spec may bind to a variable, with the spec's value for it. */
type Bindable = {
  readonly field: VariableBindableTextField;
  readonly held: TextStyleSpec["fontFamily" | "fontWeight" | "fontSize" | "lineHeight"];
};

/** The fields a spec may bind to a variable, in the order a type write binds them. */
function bindableFields(spec: TextStyleSpec): readonly Bindable[] {
  return [
    { field: "fontFamily", held: spec.fontFamily },
    { field: "fontWeight", held: spec.fontWeight },
    { field: "fontSize", held: spec.fontSize },
    { field: "lineHeight", held: spec.lineHeight },
  ];
}

/** The text fields a spec sets as literals, whose bindings a type write clears. */
function literalFields(spec: TextStyleSpec): VariableBindableTextField[] {
  return [
    "fontStyle",
    "letterSpacing",
    "paragraphIndent",
    "paragraphSpacing",
    ...bindableFields(spec)
      .filter(({ held }) => held.kind !== "variable")
      .map(({ field }) => field),
  ];
}

/**
 * Write a style's whole type. The font comes first, since a `fontName` write drops a weight binding
 * (PT1), then each field the spec sets as a literal with its binding cleared, then the bindings.
 */
function writeType(run: Run, style: TextStyle, spec: TextStyleSpec, font: FontName): void {
  const { fontSize, lineHeight } = spec;
  style.fontName = font;
  for (const field of literalFields(spec)) {
    if (boundId(style, field) !== undefined) {
      style.setBoundVariable(field, null);
    }
  }
  if (fontSize.kind === "literal") {
    style.fontSize = fontSize.value;
  }
  if (lineHeight.kind === "literal") {
    style.lineHeight = { unit: "PIXELS", value: lineHeight.value };
  } else if (lineHeight.kind === "percent") {
    style.lineHeight = { unit: "PERCENT", value: lineHeight.value };
  }
  style.letterSpacing = spec.letterSpacing;
  style.textCase = spec.textCase;
  style.textDecoration = spec.textDecoration;
  style.textWrapStyle = spec.textWrapStyle;
  // Object.assign sets the fields in DEFAULTS' key order.
  Object.assign(style, DEFAULTS);
  for (const { field, held } of bindableFields(spec)) {
    if (held.kind === "variable") {
      style.setBoundVariable(field, run.variables.variable(held.variable));
    }
  }
}

/**
 * Plan one style the file holds: its name, its description and its type.
 *
 * @returns Whether the plan rewrites its type, which resizes every text that links it.
 */
function planStyle(run: Run, style: TextStyle, spec: TextStyleSpec, font: FontName): boolean {
  const label = `${LABEL} / ${spec.name}`;
  if (style.name !== spec.name) {
    change(run.plan, label, `rename from ${style.name}`, () => {
      style.name = spec.name;
    });
  }
  if (unescaped(style.description) !== spec.description) {
    change(run.plan, label, "description", () => {
      style.description = spec.description;
    });
  }
  const drift = typeDrift(run, style, spec, font);
  if (drift.length === 0) {
    return false;
  }
  requireFont(run, label, font);
  change(run.plan, label, drift.join(", "), () => writeType(run, style, spec, font));
  return true;
}

/** A text style as the plan leaves it, and the font its writes set, which a text that links it takes. */
export type PlannedTextStyle = {
  readonly style: Target<TextStyle>;
  readonly font: FontName;
  /**
   * Whether the plan creates the style or rewrites its type, which resizes every text that links it,
   * so a page whose layout reads such a text lays out again.
   */
  readonly retypes: boolean;
};

/**
 * Plan the kit's text styles against the file's local ones: delete the keyed styles the kit dropped,
 * find each spec's style by its key or its name and plan it, or create it. A style the plan writes
 * requires the font its write sets, so Plan fails where Apply would.
 *
 * @param specs - The styles, in the order the plugin creates them.
 * @returns The Effect that plans them, and gives each style by its key, which a layer that links it
 *   reads when its operation runs. It fails with `LayerConflict` when two styles carry one key, and
 *   with `FileNotSynced` when a family or weight variable does not resolve to a font.
 */
export const planTextStyles = Effect.fnUntraced(function* (specs: readonly TextStyleSpec[]) {
  const run = yield* currentRun;
  const local = (yield* Effect.promise(() => run.figma.getLocalTextStylesAsync())).filter(
    (style) => !style.remote
  );
  const keep = new Set(specs.map((spec) => spec.key));
  for (const stale of staleOwned(local, keep)) {
    if (keyOf(stale).startsWith(TEXT_STYLE_KEY_PREFIX)) {
      change(run.plan, LABEL, `delete ${stale.name}`, () => stale.remove());
    }
  }
  const siblings = indexSiblings(local);
  const planned = new Map<string, PlannedTextStyle>();
  for (const spec of specs) {
    const font = yield* fontOf(run, spec);
    const found = yield* findOwned(siblings, LABEL, spec.key, spec.name, isTextStyle, "text style");
    if (found !== undefined) {
      planned.set(spec.key, { style: existing(found), font, retypes: planStyle(run, found, spec, font) });
      continue;
    }
    requireFont(run, `${LABEL} / ${spec.name}`, font);
    let made: TextStyle | undefined;
    change(run.plan, LABEL, `create ${spec.name}`, () => {
      const style = run.figma.createTextStyle();
      made = style;
      setKey(style, spec.key);
      style.name = spec.name;
      style.description = spec.description;
      writeType(run, style, spec, font);
    });
    planned.set(spec.key, {
      style: {
        existing: undefined,
        get: () => {
          if (made === undefined) {
            throw new Error(`${spec.name} is read before the operation that creates it runs.`);
          }
          return made;
        },
      },
      font,
      retypes: true,
    });
  }
  const styles: ReadonlyMap<string, PlannedTextStyle> = planned;
  return styles;
});
