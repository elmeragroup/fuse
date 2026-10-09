import { parseSync, Visitor } from "oxc-parser";
import type { JSXAttributeValue, PropertyKey, StringLiteral } from "oxc-parser";

/** The props and state keys a part's `data-slot` is written through. */
const SLOT_JSX_ATTRIBUTES: ReadonlySet<string> = new Set(["data-slot", "dataSlot"]);
const SLOT_OBJECT_KEYS: ReadonlySet<string> = new Set(["data-slot", "dataSlot", "slot"]);

/**
 * Whether an AST node is a string literal. ESTree gives every literal kind the one `Literal`
 * type, so the value's runtime type is the only tag a string literal carries.
 */
function isStringLiteral(node: { readonly type: string; readonly value?: unknown }): node is StringLiteral {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree tags every literal kind `Literal`; the value's type is the only tag a string literal has
  return node.type === "Literal" && typeof node.value === "string";
}

/** The string a JSX attribute holds, written bare or in braces. */
function attributeString(value: JSXAttributeValue | null): string | undefined {
  const literal = value?.type === "JSXExpressionContainer" ? value.expression : value;
  return literal !== null && isStringLiteral(literal) ? literal.value : undefined;
}

function propertyName(key: PropertyKey): string | undefined {
  if (key.type === "Identifier") return key.name;
  return isStringLiteral(key) ? key.value : undefined;
}

/**
 * Every `data-slot` a module writes: a `data-slot` or `dataSlot` JSX attribute, and a
 * `data-slot`, `dataSlot` or `slot` object key, which covers prop objects and the `useRender`
 * state Base UI stamps as `data-slot`. A JSX `slot` attribute is React Aria's slot, not a part.
 *
 * @param relativePath - The module's path, which names it in a parse failure.
 * @param source - The module's source.
 * @returns Every literal slot the module writes, in source order.
 * @throws Error when the module does not parse, a defect in package source.
 */
export function writtenSlots(relativePath: string, source: string): string[] {
  const parsed = parseSync(relativePath, source);
  if (parsed.errors.length > 0) {
    throw new Error(
      `${relativePath} does not parse: ${parsed.errors.map((error) => error.message).join("; ")}`
    );
  }
  const slots: string[] = [];
  new Visitor({
    JSXAttribute: (attribute) => {
      const value =
        attribute.name.type === "JSXIdentifier" && SLOT_JSX_ATTRIBUTES.has(attribute.name.name)
          ? attributeString(attribute.value)
          : undefined;
      if (value !== undefined) slots.push(value);
    },
    Property: (property) => {
      const name = property.computed ? undefined : propertyName(property.key);
      const value =
        name !== undefined && SLOT_OBJECT_KEYS.has(name) && isStringLiteral(property.value)
          ? property.value.value
          : undefined;
      if (value !== undefined) slots.push(value);
    },
  }).visit(parsed.program);
  return slots;
}
