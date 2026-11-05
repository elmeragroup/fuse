import { constantValue, importedName, resolve } from "./rule-kit.ts";
import type { AnyNode, Context, NodeOf, Rule } from "./rule-kit.ts";

const HOOK_NAME = /^use[A-Z]/u;

const SERVER_SAFE_MESSAGE =
  'Bespoke icons and illustrations stay server-safe: no "use client" and no hooks. Take a variant through props, as createLogo does.';

/** The name a property key spells, or undefined for a computed key. */
function keyName(property: NodeOf<"Property">): string | undefined {
  if (property.computed) return undefined;
  if (property.key.type === "Identifier") return property.key.name;
  return property.key.type === "Literal" ? String(property.key.value) : undefined;
}

/** Whether an expression reads an import binding, such as `React` from `import React from "react"`. */
function readsImport(context: Context, node: AnyNode): boolean {
  return (
    node.type === "Identifier" &&
    resolve(context, node, node.name, "value")?.variable?.defs.some(
      ({ type }) => type === "ImportBinding"
    ) === true
  );
}

/**
 * The name a called identifier stands for as a hook: the name it is imported under, the key it is
 * destructured from, or the member a `const` reads, so `useId as makeId`, `const { useId: makeId } =
 * React` and `const grab = R.useState` are hooks; its own name for any other binding or a global.
 */
function hookName(context: Context, callee: NodeOf<"Identifier">): string {
  const variable = resolve(context, callee, callee.name, "value")?.variable;
  if (variable === undefined) return callee.name;
  const imported = importedName(variable);
  if (imported !== undefined) return imported;
  const [definition] = variable.defs;
  const declarator = definition?.node;
  if (definition?.type !== "Variable" || declarator?.type !== "VariableDeclarator") return callee.name;
  if (declarator.id.type === "ObjectPattern") {
    for (const property of declarator.id.properties) {
      if (property.type !== "Property") continue;
      const bound = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
      if (bound.start === definition.name.start) return keyName(property) ?? callee.name;
    }
    return callee.name;
  }
  const value = constantValue(context, callee, callee.name);
  return value?.type === "MemberExpression" && !value.computed && value.property.type === "Identifier"
    ? value.property.name
    : callee.name;
}

/**
 * Bespoke icons and illustrations render on the server: no client directive and no hooks. A hook is
 * judged by the binding it comes from: the name it is imported under, the key it is destructured
 * from, or the member it is read as, off any import such as `React`.
 */
export const serverSafeAsset: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Keep bespoke icons and illustrations free of client directives and hooks." },
    schema: [],
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        if (node.directive === "use client") context.report({ node, message: SERVER_SAFE_MESSAGE });
      },
      ImportSpecifier(node) {
        const imported =
          node.imported.type === "Identifier" ? node.imported.name : String(node.imported.value);
        if (HOOK_NAME.test(imported) || HOOK_NAME.test(node.local.name)) {
          context.report({ node, message: SERVER_SAFE_MESSAGE });
        }
      },
      VariableDeclarator(node) {
        // A hook destructured off an import, such as `const { useId: makeId } = React`.
        if (node.id.type !== "ObjectPattern" || node.init === null || !readsImport(context, node.init))
          return;
        for (const property of node.id.properties) {
          const key = property.type === "Property" ? keyName(property) : undefined;
          if (key !== undefined && HOOK_NAME.test(key))
            context.report({ node: property, message: SERVER_SAFE_MESSAGE });
        }
      },
      MemberExpression(node) {
        // A hook read off an import without a call, such as `const grab = R.useState`. A call is
        // reported as a call.
        if (node.parent.type === "CallExpression" && node.parent.callee === node) return;
        if (node.computed || node.property.type !== "Identifier" || !HOOK_NAME.test(node.property.name))
          return;
        if (readsImport(context, node.object)) context.report({ node, message: SERVER_SAFE_MESSAGE });
      },
      CallExpression(node) {
        const { callee } = node;
        const name =
          callee.type === "Identifier"
            ? hookName(context, callee)
            : callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier"
              ? callee.property.name
              : "";
        if (HOOK_NAME.test(name)) context.report({ node, message: SERVER_SAFE_MESSAGE });
      },
    };
  },
};

const TITLE_SLOT_MESSAGE =
  "A bespoke asset is named only through its title prop: render <title>{title}</title> behind the title guard, never a static title.";

/** A bespoke asset's only title element is the slot its `title` prop fills. */
export const assetTitleSlot: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Name bespoke assets only through the title prop's slot." },
    schema: [],
  },
  create(context) {
    return {
      JSXElement(node) {
        const { name, attributes } = node.openingElement;
        if (name.type !== "JSXIdentifier" || name.name !== "title") return;
        const [child, ...rest] = node.children;
        const isSlot =
          attributes.length === 0 &&
          rest.length === 0 &&
          child?.type === "JSXExpressionContainer" &&
          child.expression.type === "Identifier" &&
          child.expression.name === "title";
        if (!isSlot) context.report({ node, message: TITLE_SLOT_MESSAGE });
      },
    };
  },
};
