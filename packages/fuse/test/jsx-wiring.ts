/**
 * JSX readers for the Base UI wiring source contracts in `src/source-contracts.test.ts`, which
 * owns the policy and the part tables.
 */
import { Visitor } from "oxc-parser";
import type { Expression, JSXElementName, JSXOpeningElement } from "oxc-parser";

import { parseModule } from "./source-tree";

/** A JSX tag as written, such as `ComboboxPrimitive.Input`. */
function tagName(name: JSXElementName): string {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXNamespacedName") return `${name.namespace.name}:${name.name.name}`;
  return `${tagName(name.object)}.${name.property.name}`;
}

function openingElements(relativePath: string, source: string): JSXOpeningElement[] {
  const parsed = parseModule(relativePath, source);
  const elements: JSXOpeningElement[] = [];
  new Visitor({ JSXOpeningElement: (element) => void elements.push(element) }).visit(parsed.program);
  return elements;
}

const STATE_OR_WIRING_ATTRIBUTE = /^(?:disabled|readOnly|required|id|value|aria-.+)$/u;

/** `Part > RenderTag attribute` for each state or wiring attribute, or spread, on an inline render element. */
export function renderElementWiring(relativePath: string, source: string): string[] {
  return openingElements(relativePath, source).flatMap((element) =>
    element.attributes.flatMap((attribute) => {
      if (attribute.type !== "JSXAttribute" || attribute.name.name !== "render") return [];
      if (attribute.value?.type !== "JSXExpressionContainer") return [];
      if (attribute.value.expression.type !== "JSXElement") return [];
      const rendered = attribute.value.expression.openingElement;
      const prefix = `${tagName(element.name)} > ${tagName(rendered.name)}`;
      return rendered.attributes.flatMap((item) => {
        if (item.type === "JSXSpreadAttribute") return [`${prefix} {...}`];
        const name = tagName(item.name);
        return STATE_OR_WIRING_ATTRIBUTE.test(name) ? [`${prefix} ${name}`] : [];
      });
    })
  );
}

function isDefinedPropsCall(expression: Expression): boolean {
  return (
    expression.type === "CallExpression" &&
    expression.callee.type === "Identifier" &&
    expression.callee.name === "definedProps"
  );
}

/** Each listed part in the source, with `raw` for every spread that skips `definedProps(…)`. */
export function wiringPartSpreads(
  relativePath: string,
  source: string,
  parts: ReadonlySet<string>
): string[] {
  return openingElements(relativePath, source).flatMap((element) => {
    const tag = tagName(element.name);
    if (!parts.has(tag)) return [];
    const raw = element.attributes.filter(
      (attribute) => attribute.type === "JSXSpreadAttribute" && !isDefinedPropsCall(attribute.argument)
    );
    return [raw.length === 0 ? tag : `${tag} raw`];
  });
}
