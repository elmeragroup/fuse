/**
 * The local text styles the plugin keeps in the file: one per type the Text, Heading and Span
 * recipes draw. The kit draws no component set for these three, so designers set their type with
 * these styles.
 *
 * Each style's classes come from the recipe itself, called once per size and weight it exposes, and
 * Heading's from `headingClass`, which merges a level's theme roles over the recipe as `Heading`
 * renders them. Tailwind compiles the classes, the kit's layer style (`layer-style.ts`) computes the
 * style of an element that carries them, and `readType` in `typography.ts` reads its type as it reads a kit
 * label's. The style also takes the element's `text-transform`, `text-decoration-line` and
 * `text-wrap-style`, each Figma's default where the classes set none.
 *
 * Names follow the scheme `<Component>/<size>/<weight>`, with the recipe's `default` size named for
 * the `base` step it draws and the weight named for its Figma style in lowercase, such as
 * `Text/base/regular`. Heading's three themed levels are `Heading/1` to `Heading/3`, whose size,
 * line height and weight follow the theme. Two values of an axis that draw the same type, such as
 * Text's `bold`, which caps body text at `medium`, give one style.
 */
import { Effect } from "effect";

import {
  headingClass,
  headingVariants,
  spanVariants,
  textVariants,
  THEMED_HEADING_LEVELS,
} from "@elmeragroup/fuse/recipe-catalog";

import { KitUnmappable } from "./build-errors";
import type { BuildContext } from "./component-spec";
import type { Origin } from "./coverage-log";
import { normalizeCss } from "./css-values";
import type { VariableIndex } from "./css-values";
import { TEXT_STYLE_KEY_PREFIX } from "./kit-spec";
import type { TextStyleSpec } from "./kit-spec";
import { CellLedger, LayerStyle } from "./layer-style";
import type { Applied } from "./layer-style";
import { ownKey } from "./own-key";
import { readType } from "./typography";
import { compileUtilities, elementReach } from "./utility-css";
import type { CompiledUtilities } from "./utility-css";

/** One style before its classes are read: where it sits and the recipe classes it draws. */
type StyleSource = {
  /**
   * The name's segments, such as `["Text", "sm"]`. A literal weight's segment follows them, and a
   * themed Heading level, whose weight binds a variable, has none.
   */
  readonly path: readonly string[];
  readonly description: string;
  readonly classes: string;
};

/** The name of a recipe size in a style name: `default` draws the `base` step. */
function sizeName(size: string): string {
  return size === "default" ? "base" : size;
}

/** The keys of a recipe axis that are its own, in the recipe's order. */
function axisKeys<Table extends object>(table: Table): Extract<keyof Table, string>[] {
  return Object.keys(table).filter((key) => ownKey(table, key));
}

/** Each style the Text and Span recipes draw, one per size and weight, in recipe order. */
function bodySources(
  component: "Text" | "Span",
  recipe: typeof textVariants | typeof spanVariants
): StyleSource[] {
  // Span extends Text, so the two share Text's size and weight axes.
  return axisKeys(textVariants.variants.size).flatMap((size) =>
    axisKeys(textVariants.variants.weight).map((weight) => ({
      path: [component, sizeName(size)],
      description: `${component} with the size ${size} and the weight ${weight}.`,
      classes: recipe({ size, weight }),
    }))
  );
}

/** Each style the Heading draws: its themed levels, then each recipe size and weight. */
function headingSources(): StyleSource[] {
  const levels = THEMED_HEADING_LEVELS.map((level) => ({
    path: ["Heading", String(level)],
    description: `Heading at level ${level}, whose size, line height and weight follow the theme.`,
    classes: headingClass({ level }),
  }));
  // A Heading with both `size` and `font` set reads no theme role at any level.
  const sizes = axisKeys(headingVariants.variants.size).flatMap((size) =>
    axisKeys(headingVariants.variants.font).map((font) => ({
      path: ["Heading", sizeName(size)],
      description: `Heading with the size ${size} and the font ${font}.`,
      classes: headingClass({ level: 2, size, font }),
    }))
  );
  return [...levels, ...sizes];
}

/** The classes of a class string, in order. */
function splitClasses(classes: string): string[] {
  return classes.split(/\s+/).filter((className) => className !== "");
}

/** The text styles keep no coverage rows: the component sets' table covers the recipes' classes. */
const NO_COVERAGE: Origin = { record: () => undefined };

/**
 * What a style's classes apply to an element in no state, in the order the stylesheet holds their
 * rules, as the browser's cascade orders rules of one specificity. `elementReach` reads each class's
 * compiled rule: a plain rule applies, and a rule that styles only the children or descendants, as
 * `*:` and `**:` compile, applies nothing to the element. Any other class fails the build, since
 * reading it would take evaluating its selector or its condition.
 *
 * @returns The rules, or `KitUnmappable` naming the style, the class and why it cannot be read.
 */
function appliedOf(
  label: string,
  classes: string,
  compiled: CompiledUtilities
): Effect.Effect<Applied[], KitUnmappable> {
  return Effect.gen(function* () {
    const order = new Map([...compiled.rules.keys()].map((utility, index) => [utility, index]));
    const applied: Applied[] = [];
    for (const className of splitClasses(classes)) {
      const reach = elementReach(compiled, className);
      if (reach.kind === "unread") {
        return yield* new KitUnmappable({
          message: `the text style ${label}: the class \`${className}\` cannot be read, because ${reach.reason}`,
        });
      }
      if (reach.kind === "own") {
        applied.push({
          part: "text style",
          className,
          origin: NO_COVERAGE,
          rank: 0,
          order: order.get(className) ?? 0,
          at: undefined,
          declarations: reach.rule.declarations,
        });
      }
    }
    return applied;
  });
}

/** Each `text-transform` a recipe can set, as the text case Figma holds. */
const TEXT_CASES = new Map<string, TextStyleSpec["textCase"]>([
  ["none", "ORIGINAL"],
  ["uppercase", "UPPER"],
  ["lowercase", "LOWER"],
  ["capitalize", "TITLE"],
]);

/** Each `text-decoration-line` a recipe can set, as the decoration Figma holds. */
const TEXT_DECORATIONS = new Map<string, TextStyleSpec["textDecoration"]>([
  ["none", "NONE"],
  ["underline", "UNDERLINE"],
  ["line-through", "STRIKETHROUGH"],
]);

/** Each `text-wrap-style` a recipe can set, as the wrap style Figma holds. */
const TEXT_WRAP_STYLES = new Map<string, TextStyleSpec["textWrapStyle"]>([
  ["auto", "AUTO"],
  ["balance", "BALANCE"],
  ["pretty", "PRETTY"],
]);

/** No letter spacing, Figma's default and the CSS initial `normal`. */
const NO_SPACING = { unit: "PERCENT", value: 0 } as const;

/**
 * Read a keyword property into a Figma field: the field for its initial value where the classes set
 * none, and undefined for a value the table lacks.
 */
function readKeyword<Field>(
  style: LayerStyle,
  property: string,
  table: ReadonlyMap<string, Field>,
  initial: Field
): Field | undefined {
  if (!style.has(property)) {
    return initial;
  }
  return style.read(
    property,
    (value) => table.get(normalizeCss(value)),
    (field) => ({ outcome: "literal", detail: String(field) }),
    // A text style is no layer, so the read fills no layer's field.
    []
  );
}

/**
 * Read one style's type from its classes, through the layer style the kit's component sets read
 * through, as an element on a page that sets nothing of its own.
 *
 * @returns The style, or `KitUnmappable` where the classes give a field the kit cannot draw.
 */
function readStyle(source: StyleSource, context: BuildContext): Effect.Effect<TextStyleSpec, KitUnmappable> {
  const label = source.path.join("/");
  return Effect.gen(function* () {
    // A text style draws no cell, so no state holds, and the element sits on a page that sets nothing.
    const ledger = new CellLedger({
      cell: {},
      context,
      origin: NO_COVERAGE,
      record: NO_COVERAGE.record,
      inPlace: undefined,
    });
    const applied = yield* appliedOf(label, source.classes, context.compiled);
    const style = new LayerStyle(ledger, ledger.add(new Map(), applied, undefined), []);
    const type = readType(style, context.variables, []);
    const textCase = readKeyword(style, "text-transform", TEXT_CASES, "ORIGINAL");
    const textDecoration = readKeyword(style, "text-decoration-line", TEXT_DECORATIONS, "NONE");
    const textWrapStyle = readKeyword(style, "text-wrap-style", TEXT_WRAP_STYLES, "AUTO");
    const { fontFamily, fontSize, lineHeight, fontWeight } = type;
    if (
      fontFamily === undefined ||
      fontSize === undefined ||
      lineHeight === undefined ||
      fontWeight === undefined ||
      textCase === undefined ||
      textDecoration === undefined ||
      textWrapStyle === undefined
    ) {
      return yield* new KitUnmappable({
        message: `the text style ${label}: its classes give no font family, size, line height, weight, case, decoration or wrap the kit can draw`,
      });
    }
    if (style.has("letter-spacing") && type.letterSpacing === undefined) {
      return yield* new KitUnmappable({
        message: `the text style ${label}: its letter spacing does not map`,
      });
    }
    const name = fontWeight.kind === "literal" ? `${label}/${fontWeight.style.toLowerCase()}` : label;
    const spec: TextStyleSpec = {
      key: `${TEXT_STYLE_KEY_PREFIX}${name.toLowerCase()}`,
      name,
      description: source.description,
      fontFamily,
      fontWeight,
      fontSize,
      lineHeight,
      letterSpacing: type.letterSpacing ?? NO_SPACING,
      textCase,
      textDecoration,
      textWrapStyle,
    };
    return spec;
  });
}

/** Whether two styles draw the same type. */
function sameType(left: TextStyleSpec, right: TextStyleSpec): boolean {
  const { key: _leftKey, name: _leftName, description: _leftDescription, ...leftType } = left;
  const { key: _rightKey, name: _rightName, description: _rightDescription, ...rightType } = right;
  return JSON.stringify(leftType) === JSON.stringify(rightType);
}

/**
 * Build the text styles from the Text, Heading and Span recipes.
 *
 * @param variables - The synced variables, by code syntax.
 * @returns Heading's styles, then Text's, then Span's. Two axis values that draw the same type, and
 *   so get the same name, give one style. The Effect fails with `KitUnmappable` where a recipe gives a
 *   type the kit cannot draw or two types one name, and as `compileUtilities` does.
 */
export const buildTextStyles = Effect.fnUntraced(function* (variables: VariableIndex) {
  const sources = [
    ...headingSources(),
    ...bodySources("Text", textVariants),
    ...bodySources("Span", spanVariants),
  ];
  const compiled = yield* compileUtilities(sources.flatMap((source) => splitClasses(source.classes)));
  const context: BuildContext = { compiled, variables };
  const styles = new Map<string, TextStyleSpec>();
  for (const source of sources) {
    const style = yield* readStyle(source, context);
    const named = styles.get(style.key);
    if (named === undefined) {
      styles.set(style.key, style);
    } else if (!sameType(named, style)) {
      return yield* new KitUnmappable({
        message: `the text style ${style.name}: two of the recipe's values draw different types under one name`,
      });
    }
  }
  return [...styles.values()];
});
