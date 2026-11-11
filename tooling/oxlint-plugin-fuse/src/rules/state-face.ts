import type { ESTree, Rule } from "@oxlint/plugins";

import { propertyKeyName } from "../ast-names.ts";
import { classesOf, parseClass } from "../class-token.ts";
import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/** A dim: the utilities the state face uses to show a control is disabled. */
const DIM = /^(?:opacity-\d+|pointer-events-none)$/u;

/** A variant that names the control's own disabled state. */
const DISABLED_VARIANT = /^(?:disabled|data-disabled|aria-disabled|has-disabled|disabled-state)$/u;

/** A variant that reads another element's state (`group-*`, `peer-*`, `in-*`). */
const OTHER_ELEMENT = /^(?:group|peer|in)-/u;

/** A prop or variant name that carries the disabled state, such as `isVisuallyDisabled`. */
const DISABLED_NAME = /disabled/iu;

/** Whether a class dims a control on its own disabled state, through a selector variant. */
function isSelectorDim(token: string): boolean {
  const { variants, utility } = parseClass(token);
  if (!DIM.test(utility) || variants.some((variant) => OTHER_ELEMENT.test(variant))) return false;
  return variants.some(
    (variant) =>
      DISABLED_VARIANT.test(variant) ||
      (/^(?:data|aria|has)-\[/u.test(variant) && variant.includes("disabled"))
  );
}

/** Whether a class is a `hover:` or `active:` face with no `enabled-*` gate. */
function isUngatedPointerFace(token: string): boolean {
  const { variants, utility } = parseClass(token);
  return utility.length > 0 && (variants.includes("hover") || variants.includes("active"));
}

/**
 * The last name a condition reads: `isDisabled` for `this.isDisabled` or `field.state().disabled`,
 * whatever the object before it is.
 */
function trailingName(node: ESTree.Node): string | undefined {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  return undefined;
}

/**
 * Whether a string carries the disabled state through its place in the code rather than a
 * selector: inside a `tv` arm keyed `isDisabled` or `disabled`, or the result of a condition on a
 * disabled-named value, such as `isVisuallyDisabled && "opacity-70"`.
 */
function underDisabledState(node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  for (let parent = node.parent; parent !== null; child = parent, parent = parent.parent) {
    if (parent.type === "Property" && parent.value === child) {
      const name = propertyKeyName(parent);
      if (name === "isDisabled" || name === "disabled") return true;
    }
    if (parent.type === "LogicalExpression" && parent.operator === "&&" && parent.right === child) {
      return DISABLED_NAME.test(trailingName(parent.left) ?? "");
    }
    if (parent.type === "ConditionalExpression" && parent.consequent === child) {
      return DISABLED_NAME.test(trailingName(parent.test) ?? "");
    }
    if (parent.type === "ExpressionStatement" || parent.type === "VariableDeclarator") return false;
  }
  return false;
}

/**
 * A disabled control takes its dim from the state face (`styles/state-face.ts`), and a hover or
 * press face sits behind `enabled-hover:` / `enabled-active:` from fuse.css, so a disabled control
 * never lights up under the pointer. A part that cannot be disabled, or a reviewed exception,
 * carries a disable comment with its reason.
 */
export const stateFace: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require the shared state face for disabled dims and gated pointer faces." },
    messages: {
      dim: "`{{token}}` dims a disabled control locally. Take the dim from styles/state-face.ts.",
      pointer:
        "`{{token}}` lights up a control that may be disabled. Gate it as `enabled-hover:` or `enabled-active:`.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const check = (node: ESTree.Node): void => {
      const text = staticText(node);
      if (text === undefined) return;
      const tokens = classesOf(text);
      const stateHeld = tokens.some((token) => DIM.test(token)) && underDisabledState(node);
      for (const token of tokens) {
        if (isSelectorDim(token) || (stateHeld && DIM.test(token))) {
          context.report({ node, messageId: "dim", data: { token } });
        } else if (isUngatedPointerFace(token)) {
          context.report({ node, messageId: "pointer", data: { token } });
        }
      }
    };
    return { Literal: check, TemplateElement: check };
  },
};
