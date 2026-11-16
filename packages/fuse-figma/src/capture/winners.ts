/**
 * Resolve an element's cascade from the rules Chromium matched on it: which authored declaration
 * wins each longhand, by origin, layer, importance, specificity and order (CSS Cascade 5 §6), and
 * which class each winning rule selects through. Chromium decides which rules match, so nothing here
 * matches a selector. It reads a selector only for the class names it names.
 */

import type { CapturedDeclaration, DeclarationSource } from "./capture-format.ts";

/** One declaration as a matched rule writes it. */
export type RawProperty = {
  readonly name: string;
  /** The value as written, without `!important`. */
  readonly value: string;
  readonly important: boolean;
  /** The longhands the property sets, its own name for a longhand. */
  readonly longhands: readonly string[];
};

/**
 * Where a matched rule comes from: a source the capture records, a theme layer, which sets the synced
 * variables, or `harness`, a rule the compare page adds to place, hide and steady its cells, as `*`'s
 * `animation: none`, which no consumer page sets.
 */
export type RuleSource = DeclarationSource | "theme" | "harness";

/** A rule Chromium matched on an element, in the order it listed them, or the `style` attribute. */
export type RawRule = {
  readonly source: RuleSource;
  /**
   * The rule's cascade layer, empty for an unlayered rule. The page declares the layers in
   * {@link LAYER_ORDER}'s order.
   */
  readonly layer: string;
  /** The selectors of the rule that matched the element, joined with a comma. */
  readonly selector: string;
  /** The highest specificity among the selectors that matched, as `[a, b, c]`. */
  readonly specificity: readonly [number, number, number];
  readonly properties: readonly RawProperty[];
};

/** A rule from a source the capture records. */
export type RecordedRule = RawRule & { readonly source: DeclarationSource };

/**
 * Whether the capture records a rule's declarations: every rule but a theme layer's and the
 * harness's.
 *
 * @param rule - The rule.
 * @returns Whether its source is one the capture records.
 */
export function isRecorded(rule: RawRule): rule is RecordedRule {
  return rule.source !== "theme" && rule.source !== "harness";
}

/** The layers the page declares, in its `@layer` statement's order. */
export const LAYER_ORDER: readonly string[] = ["properties", "theme", "base", "components", "utilities"];

/** A rule names a layer the page does not declare, so its rank is unknown. */
export class UnknownLayer extends Error {
  readonly _tag = "UnknownLayer" as const;
}

/**
 * The rank of a declaration's origin and importance (CSS Cascade 5 §6.2): the browser's normal ones,
 * then the author's in layer order with unlayered last, then the `style` attribute's, then the
 * author's important ones in reverse layer order, the `style` attribute's important ones, and the
 * browser's important ones last.
 */
function originRank(rule: RawRule, important: boolean): readonly number[] | UnknownLayer {
  if (rule.source === "user-agent") {
    return important ? [7] : [0];
  }
  if (rule.source === "inline") {
    return important ? [6] : [4];
  }
  const index = rule.layer === "" ? LAYER_ORDER.length : LAYER_ORDER.indexOf(rule.layer.split(".")[0] ?? "");
  if (index < 0) {
    return new UnknownLayer(`a rule sits in the layer ${rule.layer}, which the page does not declare`);
  }
  return important ? [5, LAYER_ORDER.length - index] : [2, index];
}

/** The physical side of each logical side on a horizontal, left-to-right page. */
const PHYSICAL_SIDES: readonly (readonly [RegExp, string])[] = [
  [/inline-start/, "left"],
  [/inline-end/, "right"],
  [/block-start/, "top"],
  [/block-end/, "bottom"],
];

/** The physical corner of each logical corner on a horizontal, left-to-right page. */
const PHYSICAL_CORNERS: ReadonlyMap<string, string> = new Map([
  ["start-start", "top-left"],
  ["start-end", "top-right"],
  ["end-start", "bottom-left"],
  ["end-end", "bottom-right"],
]);

/** The physical dimension of each logical one. */
const PHYSICAL_SIZES: ReadonlyMap<string, string> = new Map([
  ["inline-size", "width"],
  ["block-size", "height"],
  ["min-inline-size", "min-width"],
  ["min-block-size", "min-height"],
  ["max-inline-size", "max-width"],
  ["max-block-size", "max-height"],
]);

/**
 * The physical longhand a logical one sets on the page the capture renders, horizontal and left to
 * right, which the cascade resolves together with it (CSS Logical Properties 1 §4): `padding-inline-
 * start` is `padding-left`, and `inset-inline-end` is `right`. Any other longhand is itself.
 *
 * @param longhand - A longhand.
 * @returns Its physical longhand.
 */
export function physicalLonghand(longhand: string): string {
  const size = PHYSICAL_SIZES.get(longhand);
  if (size !== undefined) {
    return size;
  }
  const corner = /^border-(start|end)-(start|end)-radius$/.exec(longhand);
  if (corner !== null) {
    return `border-${PHYSICAL_CORNERS.get(`${corner[1] ?? ""}-${corner[2] ?? ""}`) ?? ""}-radius`;
  }
  for (const [logical, physical] of PHYSICAL_SIDES) {
    if (logical.test(longhand)) {
      return longhand.replace(/^inset-/, "").replace(logical, physical);
    }
  }
  return longhand;
}

/** Compare two rank tuples, shorter ones padded with zeros. */
function compareRanks(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/** A declaration the element carries, with the class that owns it, and what ranks it in the cascade. */
type Ranked = {
  readonly rule: RawRule;
  readonly property: RawProperty;
  readonly rank: readonly number[];
};

/**
 * The class names a selector names, unescaped, outside its attribute selectors and strings. `.a\:b`
 * names `a:b`, and `.\31 0` names `10` (CSS Syntax 3 §4.3.7).
 *
 * @param selector - A selector list.
 * @returns The class names, in the selector's order.
 */
export function classNamesIn(selector: string): readonly string[] {
  const names: string[] = [];
  let bracket = 0;
  let quote: string | undefined;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index] ?? "";
    if (quote !== undefined) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = undefined;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[") {
      bracket += 1;
    } else if (character === "]") {
      bracket -= 1;
    } else if (character === "\\") {
      index += 1;
    } else if (character === "." && bracket === 0) {
      const [name, end] = readIdentifier(selector, index + 1);
      if (name !== "") {
        names.push(name);
      }
      index = end - 1;
    }
  }
  return names;
}

/** Read an identifier with its escapes from `start`, returning it unescaped and the index after it. */
function readIdentifier(text: string, start: number): readonly [string, number] {
  let name = "";
  let index = start;
  while (index < text.length) {
    const character = text[index] ?? "";
    if (character === "\\") {
      const hex = /^[0-9a-fA-F]{1,6}/.exec(text.slice(index + 1))?.[0];
      if (hex === undefined) {
        name += text[index + 1] ?? "";
        index += 2;
      } else {
        name += String.fromCodePoint(Number.parseInt(hex, 16));
        index += 1 + hex.length;
        if (/\s/.test(text[index] ?? "")) {
          index += 1;
        }
      }
    } else if (/[\w-]/.test(character) || character.charCodeAt(0) > 0x7f) {
      name += character;
      index += 1;
    } else {
      break;
    }
  }
  return [name, index];
}

/** What names a rule that selects through no class, by where it comes from. */
const UNCLASSED = {
  fuse: "fuse.css base layer",
  preflight: "tailwind preflight",
  "user-agent": "user agent",
  page: "host page",
  inline: "inline style",
} as const satisfies Record<DeclarationSource, string>;

/**
 * The complex selectors of a selector list, split at its top-level commas, outside brackets,
 * parentheses and strings.
 *
 * @param list - The selector list, such as `.a:hover, .b > *`.
 * @returns Each selector, trimmed, such as `.a:hover` and `.b > *`.
 */
export function selectorsIn(list: string): readonly string[] {
  const selectors: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let index = 0; index < list.length; index += 1) {
    const character = list[index] ?? "";
    if (quote !== undefined) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = undefined;
      }
    } else if (character === "\\") {
      index += 1;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(" || character === "[") {
      depth += 1;
    } else if (character === ")" || character === "]") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      selectors.push(list.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(list.slice(start).trim());
  return selectors.filter((selector) => selector !== "");
}

/** The class a rule selects through, and how many elements up the element that carries it sits. */
export type OwningClass = { readonly className: string; readonly owner: number };

/**
 * The class a rule selects through and the element that carries it: the first of the rule's class
 * names the element carries, or else the nearest ancestor's.
 *
 * @param rule - The rule.
 * @param classes - The classes of the element, then of each ancestor up to `<html>`.
 * @returns The class and how many elements up it sits, or the rule's unclassed name on the element.
 */
export function owningClass(rule: RecordedRule, classes: readonly (readonly string[])[]): OwningClass {
  const named = classNamesIn(rule.selector);
  for (const [owner, carried] of classes.entries()) {
    const className = named.find((name) => carried.includes(name));
    if (className !== undefined) {
      return { className, owner };
    }
  }
  return { className: UNCLASSED[rule.source], owner: 0 };
}

/** A declaration that wins at least one longhand of an element, with its rule. */
export type Winner<Rule extends RawRule> = {
  readonly rule: Rule;
  readonly property: RawProperty;
  /** The longhands the declaration wins. */
  readonly longhands: readonly string[];
};

/**
 * Resolve an element's winning declarations. Each longhand goes to the declaration that ranks
 * highest by origin and importance, then specificity, then the order Chromium listed the rules in,
 * which is their order in the style sheets. A declaration that wins no longhand drops out.
 *
 * @template Rule - The rule type, which may carry more than `RawRule` does.
 * @param rules - The rules Chromium matched, in its order, the `style` attribute's last.
 * @returns The winners in cascade order, each with the longhands it wins, or `UnknownLayer`.
 */
export function resolveWinners<Rule extends RawRule>(
  rules: readonly Rule[]
): readonly Winner<Rule>[] | UnknownLayer {
  const ranked: (Ranked & { readonly rule: Rule })[] = [];
  for (const [order, rule] of rules.entries()) {
    for (const property of rule.properties) {
      const origin = originRank(rule, property.important);
      if (origin instanceof UnknownLayer) {
        return origin;
      }
      ranked.push({ rule, property, rank: [...origin, ...rule.specificity, order] });
    }
  }
  // A stable sort keeps a rule's later declaration of a longhand after its earlier one.
  const sorted = ranked.toSorted((left, right) => compareRanks(left.rank, right.rank));
  const winner = new Map<string, Ranked>();
  for (const entry of sorted) {
    for (const longhand of entry.property.longhands) {
      winner.set(longhand, entry);
    }
  }
  return sorted.flatMap(({ rule, property }) => {
    const longhands = property.longhands.filter((longhand) => winner.get(longhand)?.property === property);
    return longhands.length === 0 ? [] : [{ rule, property, longhands }];
  });
}

/**
 * A winner as the capture records it.
 *
 * @param winner - The winner.
 * @param classes - The classes of the element, then of each ancestor, which name the rule's class.
 * @returns The declaration.
 */
export function capturedDeclaration(
  winner: Winner<RecordedRule>,
  classes: readonly (readonly string[])[]
): CapturedDeclaration {
  const { rule, property, longhands } = winner;
  return {
    property: property.name,
    value: property.value,
    important: property.important,
    longhands,
    source: rule.source,
    layer: rule.layer,
    selector: rule.selector,
    ...owningClass(rule, classes),
  };
}
