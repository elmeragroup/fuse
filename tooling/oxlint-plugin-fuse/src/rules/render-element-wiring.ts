import type { ESTree, Rule } from "@oxlint/plugins";

import { nameChain, propertyKeyName } from "../ast-names.ts";
import { unwrap } from "../ast-walk.ts";
import { isTestFile } from "../source-file.ts";

/** Attributes that carry state or wiring a part owns. */
const STATE_OR_WIRING = /^(?:disabled|readOnly|required|id|value|aria-.+)$/u;

/**
 * The values an expression can take through `??`, `||`, `&&` and either branch of a ternary, so
 * `render={render ?? (icon ? <A /> : <B />)}` yields `render`, `<A />` and `<B />`.
 */
function outcomes(expression: ESTree.Node): ESTree.Node[] {
  const node = unwrap(expression);
  if (node.type === "LogicalExpression") return [...outcomes(node.left), ...outcomes(node.right)];
  if (node.type === "ConditionalExpression")
    return [...outcomes(node.consequent), ...outcomes(node.alternate)];
  return [node];
}

/** The dotted name an expression reads, such as `label` or `props.label`, or `undefined` for any other value. */
function readName(expression: ESTree.Node): string | undefined {
  return nameChain(unwrap(expression))?.join(".");
}

/** Whether a spread can yield an object literal with an `"aria-label"` key, as `{...(c ? { "aria-label": a } : null)}` does. */
function spreadsAriaLabel(spread: ESTree.JSXSpreadAttribute): boolean {
  return outcomes(spread.argument).some(
    (value) =>
      value.type === "ObjectExpression" &&
      value.properties.some(
        (property) => property.type === "Property" && propertyKeyName(property) === "aria-label"
      )
  );
}

/**
 * The name a part's opening element gives it for certain: the dotted name its last
 * `aria-label={name}` reads, or `undefined` when it has none, its value is not a name, or a later
 * spread may overwrite it with an object literal's `"aria-label"`. A later spread of a plain
 * identifier or call, such as `{...props}`, is the consumer's override and leaves the name standing.
 */
function effectiveName(part: ESTree.JSXOpeningElement): string | undefined {
  let name: string | undefined;
  for (const item of part.attributes) {
    if (item.type === "JSXSpreadAttribute") {
      if (spreadsAriaLabel(item)) name = undefined;
    } else if (nameChain(item.name).join(".") === "aria-label") {
      name = item.value?.type === "JSXExpressionContainer" ? readName(item.value.expression) : undefined;
    }
  }
  return name;
}

/** Whether a render element's attribute is `aria-label={name}` repeating the part's effective name. */
function repeatsOwnName(attribute: ESTree.JSXAttribute, part: ESTree.JSXOpeningElement): boolean {
  if (attribute.value?.type !== "JSXExpressionContainer") return false;
  const name = readName(attribute.value.expression);
  return name !== undefined && name === effectiveName(part);
}

/**
 * An inline `render={<Element …/>}` element carries no state or wiring attribute (`disabled`,
 * `readOnly`, `required`, `id`, `value`, `aria-*`) and no spread. A render element's props beat the
 * part's own props and Root or Field state, so a `disabled={false}` there re-enabled a disabled
 * Combobox.Root (#49). State and wiring go on the part; the render element takes presentation.
 *
 * The rule reads every element the `render` expression can yield through `??`, `||`, `&&` and
 * ternaries, so a fallback such as `render={render ?? <Button … />}` is held to the same contract.
 *
 * One attribute is exempt: an `aria-label` that repeats the part's effective name. An icon-size
 * `Button` requires an `aria-label`, and as a render element its value wins the merge, so it must be
 * the name the part already resolved. The rule accepts it only when its expression reads the same
 * identifier or member chain (`label`, `props.label`) as the last `aria-label={name}` on the part's
 * own opening element, and no later spread there can yield an object literal with an
 * `"aria-label"` key. A later `{...props}` stays allowed: that is the consumer's override, which the
 * part's name expression already reads first. The check is conservative and syntactic: it does not
 * reason about names that arrive through spread object literals, conditional names, or outer parts
 * the element renders into, and a computed read, a call or a literal never matches. Those cases are
 * reported, and a reasoned disable covers one that is correct.
 */
export const renderElementWiring: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Keep state and wiring off inline render elements." },
    messages: {
      attribute:
        "Put `{{attribute}}` on {{part}}, not on its render element: the render element's props override the part's own state and wiring.",
      spread:
        "Spread props onto {{part}}, not its render element: the render element's props override the part's own state and wiring.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    return {
      JSXAttribute(attribute) {
        if (attribute.name.type !== "JSXIdentifier" || attribute.name.name !== "render") return;
        const value = attribute.value;
        if (value?.type !== "JSXExpressionContainer") return;
        const owner = attribute.parent;
        if (owner.type !== "JSXOpeningElement") return;
        const part = nameChain(owner.name).join(".");
        for (const element of outcomes(value.expression)) {
          if (element.type !== "JSXElement") continue;
          for (const item of element.openingElement.attributes) {
            if (item.type === "JSXSpreadAttribute") {
              context.report({ node: item, messageId: "spread", data: { part } });
              continue;
            }
            const name = nameChain(item.name).join(".");
            if (!STATE_OR_WIRING.test(name)) continue;
            if (name === "aria-label" && repeatsOwnName(item, owner)) continue;
            context.report({ node: item, messageId: "attribute", data: { part, attribute: name } });
          }
        }
      },
    };
  },
};
