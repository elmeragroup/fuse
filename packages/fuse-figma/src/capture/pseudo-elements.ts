import type { BoxCascade, CapturedText, IconCascade, PseudoCascade } from "../components/box-cascade.ts";
import type { IconSlot } from "../components/component-spec.ts";
/**
 * What a box's `::before` and `::after` paint, read from their cascaded style: the border
 * shorthands split into their longhands, and each declaration's verdict, which says whether the
 * pseudo-element paints, paints nothing, or sets a longhand the build does not read.
 * `capture-cascade.ts` cascades each pseudo-element over its box and asks this module what becomes
 * of its declarations. `border-shorthands.ts` splits the border shorthands.
 */
import { evaluateLength, normalizeCss, readColor } from "../components/css-values.ts";
import type { VariableIndex } from "../components/css-values.ts";
import type { NumberSpec } from "../components/kit-spec.ts";
import type { Applied, CoverageNote, InPlace, LayerStyle } from "../components/layer-style.ts";
import { BORDER_STYLES, borderLonghands, WIDTH_KEYWORDS } from "./border-shorthands.ts";

/**
 * The longhands a pseudo-element's style can set and still paint nothing a box shows: its place,
 * size, spacing and box model, its border and outline styles and colors, which a zero width or no
 * style leaves unpainted, its background's placement, which no image paints, the text style a
 * pseudo-element with no text draws nothing with, and its motion.
 */
const PSEUDO_SILENT = new RegExp(
  `^(?:${[
    "--.*",
    "position",
    "top|right|bottom|left|inset.*",
    "(?:min-|max-)?(?:width|height)",
    "(?:margin|padding)(?:-.*)?",
    "box-sizing|display|pointer-events|z-index|cursor|unicode-bidi|visibility|opacity",
    "border-(?:.*-)?radius",
    "outline-(?:color|offset|width)",
    "background-(?:position.*|size|repeat|clip|origin|attachment)",
    "color|font.*|line-height|letter-spacing|text-.*|white-space.*|word-.*",
    "transition.*|animation.*|transform.*|translate|rotate|scale|will-change",
  ].join("|")})$`
);

/** The border styles that draw no border, whatever its width (CSS Backgrounds 3 §4.2). */
const NO_BORDER = new Set(["none", "hidden"]);

/**
 * Declarations with each border shorthand split into its longhands, as {@link borderLonghands} says,
 * so the cascade decides each side's width, style and color by its usual precedence.
 *
 * @param applied - The declarations.
 * @param resolve - A declaration's value with its `var()`s substituted, by its property and value as
 *   written, or undefined where it does not resolve.
 */
export function withBorderLonghands(
  applied: readonly Applied[],
  resolve: (property: string, value: string) => string | undefined
): Applied[] {
  return applied.map((each) => ({
    ...each,
    declarations: each.declarations.flatMap(({ property, value }) =>
      (borderLonghands(property, value, resolve(property, value)) ?? [[property, value] as const]).map(
        ([longhand, part]) => ({
          property: longhand,
          value: part,
        })
      )
    ),
  }));
}

/**
 * Whether a side of a pseudo-element's border paints: its resolved style draws, and its width does
 * not resolve to zero, a width the build cannot resolve counting as painting. Undefined for a style
 * that resolves to no border style.
 */
function sidePaints(style: LayerStyle, side: string): boolean | undefined {
  const lineStyle = normalizeCss(style.resolved(`border-${side}-style`) ?? "none").toLowerCase();
  if (!BORDER_STYLES.has(lineStyle)) {
    return undefined;
  }
  if (NO_BORDER.has(lineStyle)) {
    return false;
  }
  const width = normalizeCss(style.resolved(`border-${side}-width`) ?? "medium").toLowerCase();
  return (evaluateLength(width) ?? WIDTH_KEYWORDS.get(width)) !== 0;
}

/**
 * Whether a property of a pseudo-element's resolved style paints, by its value, or undefined where the
 * build does not tell. A border side's width, style and color paint together, as {@link sidePaints}
 * reads them, and a border shorthand left unsplit is one the build does not tell.
 */
function pseudoPaint(
  style: LayerStyle,
  property: string,
  properties: readonly string[],
  variables: VariableIndex
): boolean | undefined {
  const value = normalizeCss(style.resolved(property) ?? "").toLowerCase();
  if (property === "content") {
    return !["", '""', "''", "none", "normal"].includes(value);
  }
  const side = /^border-(top|right|bottom|left)-(?:width|style|color)$/.exec(property)?.[1];
  if (side !== undefined) {
    return sidePaints(style, side);
  }
  if (property === "background-color" || property === "background") {
    if (["transparent", "none"].includes(value)) {
      return false;
    }
    const color = readColor(value, variables);
    return color?.kind === "literal" ? color.color.a > 0 : true;
  }
  if (property === "background-image" || property === "box-shadow") {
    return value !== "none";
  }
  if (property === "outline-style" || property === "outline") {
    return !value.split(" ").every((token) => token === "none" || evaluateLength(token) === 0);
  }
  return PSEUDO_SILENT.test(property) ? false : undefined;
}

/** What a pseudo-element's declarations come to, and whether it paints a box the build reads whole. */
export type PseudoVerdict = CoverageNote & {
  /** Whether the pseudo-element paints, with every longhand it sets one the build reads. */
  readonly paints: boolean;
};

/**
 * What becomes of a pseudo-element's declarations where the kit draws no layer for it: dropped where
 * its `display` is `none`, which generates no box, or where its resolved style paints nothing, as a
 * control's hit area does with empty content and no fill,
 * border, shadow or outline, and unmapped where it paints or sets a longhand the build does not
 * read, such as a `backdrop-filter`, which blurs what lies behind it with no paint of its own.
 *
 * @param style - The pseudo-element's style, cascaded over its box.
 * @param pseudo - Its name, such as `before`.
 * @param variables - The synced variables a color reads.
 * @returns The note each declaration takes, and whether the pseudo-element paints.
 */
export function pseudoVerdict(style: LayerStyle, pseudo: string, variables: VariableIndex): PseudoVerdict {
  // A pseudo-element whose `display` is `none` generates no box (CSS Display 3 §2.5), so whatever
  // else it sets paints nothing.
  if (normalizeCss(style.resolved("display") ?? "").toLowerCase() === "none") {
    return {
      outcome: "dropped",
      detail: `the \`::${pseudo}\` pseudo-element generates no box, since its \`display\` is \`none\``,
      paints: false,
    };
  }
  const properties = style.ownProperties();
  const verdicts = properties.map((property) => ({
    property,
    paints: pseudoPaint(style, property, properties, variables),
  }));
  const unread = verdicts.flatMap(({ property, paints }) => (paints === undefined ? [property] : []));
  const paints = verdicts.flatMap(({ property, paints }) => (paints === true ? [property] : []));
  if (unread.length > 0) {
    return {
      outcome: "unmapped",
      detail: `the kit draws no layer for the \`::${pseudo}\` pseudo-element, and the build does not tell whether its ${unread.join(", ")} paints`,
      paints: false,
    };
  }
  return paints.length > 0
    ? {
        outcome: "unmapped",
        detail: `the kit draws no layer for the \`::${pseudo}\` pseudo-element, whose ${paints.join(", ")} paints`,
        paints: true,
      }
    : {
        outcome: "dropped",
        detail: `the \`::${pseudo}\` pseudo-element paints nothing: its content is empty and it sets no fill, border, shadow or outline`,
        paints: false,
      };
}

/**
 * The cascade of a pseudo-element the mapping draws as a layer: its own style, cascaded over its box,
 * and nothing below it, since a generated box holds no element, icon or label the kit draws. The
 * mapping draws it from a part definition with none of them, so it never asks this cascade for one.
 */
export class PseudoBoxCascade implements BoxCascade {
  readonly style: LayerStyle;
  readonly path: readonly string[];
  readonly #inPlace: InPlace | undefined;
  readonly elementChildren = 0;
  readonly elementTag = undefined;
  readonly elementText = undefined;
  readonly markerContent = false;
  readonly measured = undefined;
  readonly drawnAt = undefined;
  readonly pseudoElements: readonly PseudoCascade[] = [];

  /**
   * @param style - The pseudo-element's style.
   * @param inPlace - The instance part built in place whose layers hold the box, or undefined.
   */
  constructor(style: LayerStyle, inPlace: InPlace | undefined) {
    this.style = style;
    this.path = style.path;
    this.#inPlace = inPlace;
  }

  spaceChildren(): NumberSpec | undefined {
    return undefined;
  }

  inPlace(): InPlace | undefined {
    return this.#inPlace;
  }

  part(part: string): BoxCascade {
    throw new Error(`a pseudo-element holds no part, yet the mapping asked it for ${part}`);
  }

  instance(part: string): BoxCascade {
    throw new Error(`a pseudo-element holds no instance, yet the mapping asked it for ${part}`);
  }

  labelElement(): undefined {
    return undefined;
  }

  capturedText(): CapturedText {
    return { _tag: "Unresolved", reason: "a pseudo-element's box holds no label of the kit's" };
  }

  textRuns(): undefined {
    return undefined;
  }

  icon(slot: IconSlot): IconCascade {
    throw new Error(`a pseudo-element holds no icon, yet the mapping asked it for ${slot.key}`);
  }
}
