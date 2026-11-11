import type { ESTree } from "@oxlint/plugins";
import type { PropertyKey as ParsedPropertyKey } from "oxc-parser";

import { stringLiteral } from "./static-text.ts";

/** A node that may spell a name: an expression, a type name, or a JSX tag or attribute name. */
type NameNode =
  | ESTree.Node
  | ESTree.JSXElementName
  | ESTree.JSXMemberExpressionObject
  | ESTree.JSXAttributeName;

/**
 * A dotted name's identifiers, outermost first: `Base.Dialog.Root` in code, a type or a JSX tag
 * gives `["Base", "Dialog", "Root"]`. A namespaced JSX name such as `xlink:href` is one segment.
 *
 * @param node - An identifier, a member read, a qualified type name or a JSX name.
 * @returns The segments, or `undefined` past a computed or call step. A JSX name always has them.
 */
export function nameChain(node: ESTree.JSXElementName | ESTree.JSXAttributeName): string[];
export function nameChain(node: NameNode): string[] | undefined;
export function nameChain(node: NameNode): string[] | undefined {
  switch (node.type) {
    case "Identifier":
    case "JSXIdentifier":
      return [node.name];
    case "JSXNamespacedName":
      return [`${node.namespace.name}:${node.name.name}`];
    case "MemberExpression": {
      if (node.computed || node.property.type !== "Identifier") return undefined;
      const object = nameChain(node.object);
      return object === undefined ? undefined : [...object, node.property.name];
    }
    case "JSXMemberExpression":
      return [...nameChain(node.object), node.property.name];
    case "TSQualifiedName": {
      const left = nameChain(node.left);
      return left === undefined ? undefined : [...left, node.right.name];
    }
    default:
      return undefined;
  }
}

/**
 * A property key's name: `isDisabled` for `isDisabled: …`, `data-slot` for `"data-slot": …` or
 * `["data-slot"]: …`. A computed identifier such as `[key]` names nothing.
 *
 * @param property - A property from oxlint's AST or oxc-parser's.
 * @returns The key's name, or `undefined`.
 */
export function propertyKeyName(property: {
  readonly key: ESTree.PropertyKey | ParsedPropertyKey;
  readonly computed: boolean;
}): string | undefined {
  const key = property.key;
  if (key.type === "Identifier") return property.computed ? undefined : key.name;
  return stringLiteral(key);
}
