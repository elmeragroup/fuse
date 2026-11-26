import type { ESTree, Rule } from "@oxlint/plugins";

import { parseClass } from "../class-token.ts";
import type { Alt } from "../resolve.ts";
import { evaluate, textParts } from "../resolve.ts";
import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/** The calls that join their arguments into one class list. */
const CLASS_CALLS: ReadonlySet<string> = new Set(["cn", "mergeClassName", "clsx", "cx", "twMerge"]);

/**
 * The `data-*` names that carry a state a part may show through its fill: pressed, checked,
 * indeterminate, selected, active, current, highlighted, open, armed, a date range's ends and
 * span, a column being resized and a drop target. A status face such as `data-[state=error]` is
 * not among them.
 */
const DATA_STATE =
  "pressed|checked|indeterminate|selected|active|current|highlighted|popup-open|open|armed|in-range|selection-start|selection-end|resizing|drop-target";

/** The `aria-*` names that carry the same states. */
const ARIA_STATE = "pressed|checked|selected|current|expanded";

/**
 * A prefix that reads the state off another element: an ancestor, a sibling or a descendant.
 * Prefixes stack, as in `group-has-data-checked/item`.
 */
const OTHER_ELEMENT = "(?:group-|peer-|in-|has-)";

/** The bare, arbitrary and `state=` forms of a state variant, with an optional group or peer name. */
const STATE_VARIANT = new RegExp(
  `^${OTHER_ELEMENT}*(?:data-(?:${DATA_STATE})|data-\\[(?:${DATA_STATE})(?:=[^\\]]*)?\\]|data-\\[state=(?:${DATA_STATE})\\]|aria-(?:${ARIA_STATE})|aria-\\[(?:${ARIA_STATE})=[^\\]]*\\]|focus)(?:/[\\w-]+)?$`,
  "u"
);

/**
 * An arbitrary `has-[…]`, `group-[…]` or `in-[…]` selector that reads one of the states inside
 * it as an attribute: `[data-checked]`, `[data-state=selected]` or `[aria-selected=true]`.
 */
const STATE_IN_SELECTOR = new RegExp(
  `^${OTHER_ELEMENT}+\\[.*\\[(?:data-(?:${DATA_STATE})|data-state=(?:${DATA_STATE})|aria-(?:${ARIA_STATE}))[=\\]]`,
  "u"
);

/** A variant that negates its condition, such as `not-hover` or `[&:not(:disabled)]`. */
const NEGATED = /^not-|:not\(/u;

/**
 * The disabled and invalid looks, which belong to the state face: a named variant, Fuse's
 * `disabled-state` variant from `fuse.css`, an attribute that holds `true`, or an arbitrary
 * selector that reads either. `aria-[invalid=false]` is not one.
 */
const FACE =
  /^(?:aria-|data-|user-)?(?:disabled|invalid)$|^disabled-state$|^(?:aria|data)-\[(?:disabled|invalid)(?:=["']?true["']?)?\]$|^\[.*(?::(?:user-)?(?:disabled|invalid)(?![\w-])|\[(?:aria-|data-)?(?:disabled|invalid)(?:=["']?true["']?)?\])/u;

/** Hover and the `:active` press, which #1148 leaves out, by name or in an arbitrary selector. */
const POINTER = /^(?:hover|active)$|^\[.*:(?:hover|active)(?![\w-])/u;

/**
 * What a variant tests on its element: its group or peer name and its `group-`, `peer-`, `in-`,
 * `has-` and `enabled-` prefixes taken off, so `group-hover/item` tests `hover` and
 * `group-data-selected/hover-card` tests `data-selected`.
 */
function predicate(variant: string): string {
  return variant
    .replace(/^((?:group|peer)-.+)\/[\w-]+$/u, "$1")
    .replace(/^(?:group-|peer-|in-|has-|enabled-)+/u, "");
}

/** Whether a variant shows hover, the press or the disabled or invalid face, and does not negate it. */
function isLeftOut(variant: string): boolean {
  if (NEGATED.test(variant)) return false;
  const tested = predicate(variant);
  return POINTER.test(tested) || FACE.test(tested);
}

/**
 * Whether a variant moves the class to other elements: `*`, `**`, or an arbitrary selector with a
 * combinator after `&` and before any parenthesis, such as `[&>td]` or `[&_svg]`.
 */
function isTargetChange(variant: string): boolean {
  if (variant === "*" || variant === "**") return true;
  if (!variant.startsWith("[")) return false;
  const after = variant.split("&")[1];
  return after !== undefined && /^[^(]*[>_+~]/u.test(after);
}

/**
 * A `bg-*` utility that sets no color: a reset, a background's attachment, clip, origin, size,
 * repeat, position, blend or gradient, or an arbitrary image. A keyword matches by its full
 * name, so a color token such as `bg-right-panel` stays a fill.
 */
const NOT_A_FILL =
  /^bg-(?:(?:transparent|none|inherit|fixed|local|scroll|cover|contain|auto|no-repeat|repeat(?:-x|-y|-round|-space)?|center|top|bottom|left|right|(?:left|right)-(?:top|bottom)|(?:top|bottom)-(?:left|right)|radial|conic)$|(?:clip|origin|blend|linear|radial|conic|gradient|size|position)-|\[(?:url\(|image:|length:|size:|position:|image-set\(|(?:repeating-)?(?:linear|radial|conic)-gradient\()|\((?:length|size|position|image):)/u;

/** A utility with its `!` taken off. */
function bareUtility(utility: string): string {
  return utility.replace(/^!|!$/gu, "");
}

/** Whether a utility paints a background color. */
function isFill(utility: string): boolean {
  const bare = bareUtility(utility);
  return bare.startsWith("bg-") && !NOT_A_FILL.test(bare);
}

/**
 * The utilities besides `bg-*` whose value may be a color: a border, an outline, text, an SVG
 * fill or stroke, and a text decoration. The value follows the family's name.
 */
const COLOR_FAMILY = /^(?:border(?:-[xysetrbl]|-b[se])?|outline|text|fill|stroke|decoration)-(.+)$/u;

/**
 * A value in one of those families that sets no color: a width, including a bare side such as
 * `border-b`, a style, a size, an alignment, wrapping, a text shadow, a decoration's thickness or
 * offset, a table border model, a reset, or an arbitrary value typed as anything but a color. A keyword matches by its full name, so a
 * color token such as `text-center-label` stays a color.
 */
const NOT_A_COLOR =
  /^(?:\d|\.|(?:transparent|inherit|initial|unset|none|hidden|solid|dashed|dotted|double|wavy|groove|ridge|inset|outset|collapse|separate|xs|sm|base|lg|xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|auto|from-font|clone|slice|[xysetrbl]|b[se])(?:\/.*)?$|(?:offset|spacing|shadow)-|[[(](?!color:)(?:[\w-]+:|\d|\.|calc\())/u;

/**
 * Whether a forced-colors arm's utility paints a color that can show a state: a background, a
 * border, an outline, text, an SVG fill or stroke, or a text decoration. A transition, an
 * opacity, a layout utility or a bare `underline` paints none.
 */
function paints(utility: string): boolean {
  const bare = bareUtility(utility);
  if (isFill(bare)) return true;
  const value = COLOR_FAMILY.exec(bare)?.[1];
  return value !== undefined && !NOT_A_COLOR.test(value);
}

/** Whether a variant reads one of the states this rule covers. */
function isStateVariant(variant: string): boolean {
  return STATE_VARIANT.test(variant) || STATE_IN_SELECTOR.test(variant);
}

/** The variants a class tests on one element, sorted into states and scope. */
type Segment = {
  /** The covered states. */
  readonly states: readonly string[];
  /**
   * Every other variant but `forced-colors`: breakpoints, pseudo-elements, the invalid flag, and
   * group, peer and part scopes.
   */
  readonly scope: readonly string[];
};

/**
 * A class token with its variants cut into segments at each variant that moves it to other
 * elements. Variants apply left to right, so `data-selected:*:bg-muted` tests the state on the
 * element and paints its children, and `*:data-selected:bg-muted` paints each selected child.
 */
type StateClass = {
  readonly token: string;
  readonly variants: readonly string[];
  readonly utility: string;
  /** The variants that move the class, in order, one between each pair of segments. */
  readonly moves: readonly string[];
  readonly segments: readonly Segment[];
};

function stateClass(token: string): StateClass {
  const { variants, utility } = parseClass(token);
  const moves: string[] = [];
  const groups: string[][] = [[]];
  for (const variant of variants) {
    if (variant === "forced-colors") continue;
    if (isTargetChange(variant)) {
      moves.push(variant);
      groups.push([]);
    } else {
      groups[groups.length - 1]?.push(variant);
    }
  }
  return {
    token,
    variants,
    utility,
    moves,
    segments: groups.map((group) => ({
      states: group.filter(isStateVariant),
      scope: group.filter((variant) => !isStateVariant(variant)),
    })),
  };
}

/**
 * Tailwind's pseudo-element variants. A class under one paints that pseudo-element, not its host,
 * so `after:bg-primary` colors the `::after` box and leaves the element's own background alone.
 */
const PSEUDO_ELEMENT: ReadonlySet<string> = new Set([
  "before",
  "after",
  "placeholder",
  "file",
  "marker",
  "selection",
  "first-line",
  "first-letter",
  "backdrop",
  "details-content",
]);

/** The pseudo-element variants in a segment's scope. */
function pseudoElements(segment: Segment): string[] {
  return segment.scope.filter((variant) => PSEUDO_ELEMENT.has(variant));
}

/** Whether two lists hold the same variants, in any order. */
function sameVariants(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((variant) => rightSet.has(variant));
}

/**
 * Whether a class is a forced-colors arm for a fill: a `forced-highlight` companion, or a
 * `forced-colors:` class whose utility paints. A `forced-colors:` class reaches the fill's own
 * element by the same moves. The companion may also stop at an element the fill moves through,
 * when the elements past it test no state: it marks the element whose state their fill shows and
 * clears their fills, so `data-selected:forced-highlight` covers `data-selected:*:bg-muted`. On
 * each element the arm reaches, its states equal the fill's, and every other variant of the arm
 * sits on the fill's element too: a bare companion covers a fill under a group scope, and a
 * companion under `md:`, under one Tabs variant or under `data-invalid` does not cover a fill
 * without it. The arm paints the pseudo-element the fill paints: an arm on the element does not
 * cover an `after:` fill, and an `after:` arm does not cover a fill on the element. The companion
 * clears the fills of the elements past it but not their pseudo-elements, so it never stops
 * early at a fill on a pseudo-element.
 */
function isArmFor(arm: StateClass, fill: StateClass): boolean {
  const isCompanion = bareUtility(arm.utility) === "forced-highlight";
  if (!isCompanion && !(arm.variants.includes("forced-colors") && paints(arm.utility))) return false;
  return (
    (isCompanion || arm.moves.length === fill.moves.length) &&
    arm.moves.every((move, at) => move === fill.moves[at]) &&
    fill.segments.every((target, at) => {
      const segment = arm.segments[at];
      if (segment === undefined) return target.states.length === 0 && pseudoElements(target).length === 0;
      return (
        sameVariants(segment.states, target.states) &&
        sameVariants(pseudoElements(segment), pseudoElements(target)) &&
        segment.scope.every((variant) => target.scope.includes(variant))
      );
    })
  );
}

/**
 * Whether a fill needs an arm: it paints a background under a covered state, outside hover, the
 * press and the disabled and invalid faces.
 */
function needsArm(candidate: StateClass): boolean {
  return (
    candidate.variants.some(isStateVariant) &&
    isFill(candidate.utility) &&
    !candidate.variants.includes("forced-colors") &&
    !candidate.variants.some(isLeftOut)
  );
}

/** The name a call's callee spells: `cn` for `cn(…)` and `styles.cn(…)`. */
function calleeName(callee: ESTree.Node): string | undefined {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
    return callee.property.name;
  }
  return undefined;
}

/** Whether a node joins its arguments into one class list. */
function isClassCall(node: ESTree.Node): node is ESTree.CallExpression {
  return node.type === "CallExpression" && CLASS_CALLS.has(calleeName(node.callee) ?? "");
}

/** The expressions an array or a call joins: a spread as the expression it spreads, and no holes. */
function joined(node: ESTree.ArrayExpression | ESTree.CallExpression): ESTree.Node[] {
  const items: readonly ESTree.ArrayExpressionElement[] =
    node.type === "ArrayExpression" ? node.elements : node.arguments;
  return items.flatMap((item) => {
    if (item === null) return [];
    return [item.type === "SpreadElement" ? item.argument : item];
  });
}

/**
 * The arguments a class list joins: the elements of its arrays and the arguments of its `cn`
 * calls, flattened. Each is present whenever the list is, and holds its own alternatives.
 */
function argumentsOf(node: ESTree.Node): ESTree.Node[] {
  if (node.type !== "ArrayExpression" && !isClassCall(node)) return [node];
  return joined(node).flatMap((item) => argumentsOf(item));
}

/** Whether a run of class text starts or ends at a part the rule cannot read. */
type Edges = { readonly opensOnGap: boolean; readonly closesOnGap: boolean };

/**
 * The whole classes a run of text spells. Its first class runs on from a gap before it and its
 * last class into a gap after it, unless whitespace parts them, so those are only part of a class.
 */
function wholeClasses(text: string, { opensOnGap, closesOnGap }: Edges): StateClass[] {
  const tokens = text.split(/\s+/u);
  return tokens
    .filter(
      (token, at) =>
        token.length > 0 && !(opensOnGap && at === 0) && !(closesOnGap && at === tokens.length - 1)
    )
    .map(stateClass);
}

/**
 * The whole classes a string literal or template chunk spells. A chunk after the first opens on
 * a substitution, and a chunk before the tail closes on one.
 */
function spelledClasses(node: ESTree.Node, text: string): StateClass[] {
  if (node.type !== "TemplateElement") return wholeClasses(text, { opensOnGap: false, closesOnGap: false });
  return wholeClasses(text, {
    opensOnGap: node.parent.type === "TemplateLiteral" && node.parent.quasis[0] !== node,
    closesOnGap: !node.tail,
  });
}

/**
 * Forced colors replace the fill a pressed, checked, selected, current, highlighted or open part
 * shows its state through, so a part that shows its state only by its fill looks unchanged there.
 * Every such fill takes a forced-colors arm in its own class list: the `forced-highlight`
 * companion under the same states (`data-pressed:bg-toggle-pressed
 * data-pressed:forced-highlight`), or a `forced-colors:` class under the same states, tested on
 * the same element, that paints a color. The arm sits in the fill's own string, or in an argument
 * the list holds whenever it holds that string, and that argument may hold a different arm in
 * each of its alternatives. A part that shows the state by another cue, such as a check, a thumb
 * or a border, or whose companion comes from a recipe it composes, carries a disable comment with
 * its reason.
 */
export const forcedStateArm: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require a forced-colors arm beside a fill that shows a pressed, selected or open state.",
    },
    messages: {
      missing:
        "`{{token}}` shows a state only through a fill that forced colors replace. Add `{{chain}}:forced-highlight` beside it, or a `forced-colors:` class under the same state.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};

    /**
     * The expressions being read right now. A helper that recurses through a `cn` call or an
     * array reaches the same expression again, and that read holds no arm.
     */
    const reading = new Set<ESTree.Node>();

    /**
     * Whether every alternative of an expression holds an arm for the fill, read through the
     * evaluator. Alternatives may hold different arms: `open ? "forced-colors:data-selected:bg-[Mark]"
     * : "forced-colors:data-selected:bg-[Highlight]"` arms `data-selected:bg-accent` either way. A
     * token beside a part the evaluator cannot read is partial and holds no arm, and neither does
     * a value that is no string, such as the `false` of `open && "…"`.
     */
    const alwaysArms = (node: ESTree.Node, fill: StateClass): boolean => {
      if (reading.has(node)) return false;
      reading.add(node);
      const armed = evaluate(context, node, { strings: "partial" }).every((alternative) =>
        armsIn(alternative, fill)
      );
      reading.delete(node);
      return armed;
    };

    /** Whether one alternative holds an arm: in its text, or in an element or argument that always does. */
    const armsIn = (alternative: Alt, fill: StateClass): boolean => {
      if (alternative.kind === "array") {
        return alternative.elements.some(
          (element) => element._tag === "element" && element.node !== null && alwaysArms(element.node, fill)
        );
      }
      if (alternative.kind === "call" && isClassCall(alternative.node)) {
        return argumentsOf(alternative.node).some((argument) => alwaysArms(argument, fill));
      }
      const parts = textParts(alternative);
      if (parts === undefined) return false;
      return parts.some(
        (part, index) =>
          part._tag === "known" &&
          wholeClasses(part.text, {
            opensOnGap: parts[index - 1]?._tag === "gap",
            closesOnGap: parts[index + 1]?._tag === "gap",
          }).some((arm) => isArmFor(arm, fill))
      );
    };

    /**
     * Whether the list holds an arm for the fill whenever it holds this string, outside the string
     * itself. A string shares its list with the strings beside it in one template literal, array,
     * condition, or `cn` or `mergeClassName` call, so one `tv` slot, one `base` and one
     * `className` are each one list. On the way up, an array or `cn` call counts each other
     * argument that always holds an arm, and a template literal counts when every value it may
     * spell holds one. A condition counts nothing, so an arm in another branch never covers the
     * fill.
     */
    const armedBeside = (node: ESTree.Node, fill: StateClass): boolean => {
      for (let child: ESTree.Node = node; child.parent !== null; child = child.parent) {
        const parent = child.parent;
        if (parent.type === "ArrayExpression" || isClassCall(parent)) {
          const armed = joined(parent).some(
            (sibling) => sibling !== child && argumentsOf(sibling).some((part) => alwaysArms(part, fill))
          );
          if (armed) return true;
        } else if (parent.type === "TemplateLiteral") {
          if (alwaysArms(parent, fill)) return true;
        } else if (parent.type !== "ConditionalExpression" && parent.type !== "LogicalExpression") {
          return false;
        }
      }
      return false;
    };

    const check = (node: ESTree.Node): void => {
      const text = staticText(node);
      // A report needs a state variant and a `bg-` fill.
      if (text === undefined || !text.includes(":") || !text.includes("bg-")) return;
      const spelled = spelledClasses(node, text);
      for (const fill of spelled.filter(needsArm)) {
        if (spelled.some((arm) => isArmFor(arm, fill)) || armedBeside(node, fill)) continue;
        context.report({
          node,
          messageId: "missing",
          data: { token: fill.token, chain: fill.variants.join(":") },
        });
      }
    };

    return { Literal: check, TemplateElement: check };
  },
};
