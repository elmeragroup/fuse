import type { ESTree } from "@oxlint/plugins";

/**
 * A JSX tag or attribute name as written, such as `ComboboxPrimitive.Input` or `aria-label`.
 *
 * @param name - The element or attribute name node.
 * @returns The dotted or namespaced name.
 */
export function jsxName(
  name: ESTree.JSXElementName | ESTree.JSXMemberExpressionObject | ESTree.JSXAttributeName
): string {
  switch (name.type) {
    case "JSXIdentifier":
      return name.name;
    case "JSXNamespacedName":
      return `${name.namespace.name}:${name.name.name}`;
    case "JSXMemberExpression":
      return `${jsxName(name.object)}.${name.property.name}`;
  }
}
