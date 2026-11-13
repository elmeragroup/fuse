import type { ESTree } from "@oxlint/plugins";
import { parseSync, Visitor } from "oxc-parser";
import type {
  JSXAttribute as ParsedJSXAttribute,
  Node as ParsedNode,
  PropertyKey as ParsedPropertyKey,
} from "oxc-parser";

import { propertyKeyName } from "./ast-names.ts";
import { stringLiteral } from "./static-text.ts";

/**
 * The JSX attributes a part's `data-slot` is written through. A JSX `slot` attribute is the HTML
 * `slot` attribute, not a part.
 */
export const SLOT_JSX_ATTRIBUTES: ReadonlySet<string> = new Set(["data-slot", "dataSlot"]);

/** The object keys a `data-slot` is written through: props objects and `useRender` state. */
export const SLOT_OBJECT_KEYS: ReadonlySet<string> = new Set(["data-slot", "dataSlot", "slot"]);

/**
 * The slot a JSX attribute writes: a `data-slot` or `dataSlot` attribute holding a string, bare
 * or in braces. The density lint rule and the studio's slot index both read slots through this
 * module, so they cover the same slots.
 *
 * @param attribute - A JSX attribute from oxlint's AST or oxc-parser's.
 * @returns The slot, or `undefined` for any other attribute or a value that can vary.
 */
export function jsxAttributeSlot(attribute: ESTree.JSXAttribute | ParsedJSXAttribute): string | undefined {
  if (attribute.name.type !== "JSXIdentifier" || !SLOT_JSX_ATTRIBUTES.has(attribute.name.name)) {
    return undefined;
  }
  const value = attribute.value;
  return stringLiteral(value?.type === "JSXExpressionContainer" ? value.expression : value);
}

/**
 * The slot an object property writes: a `data-slot`, `dataSlot` or `slot` key holding a string.
 *
 * @param property - An object or pattern property from oxlint's AST or oxc-parser's.
 * @returns The slot, or `undefined` for any other property or a value that can vary.
 */
export function propertySlot(property: {
  readonly key: ESTree.PropertyKey | ParsedPropertyKey;
  readonly computed: boolean;
  readonly value: ESTree.Node | ParsedNode;
}): string | undefined {
  if (property.computed) return undefined;
  const name = propertyKeyName(property);
  return name !== undefined && SLOT_OBJECT_KEYS.has(name) ? stringLiteral(property.value) : undefined;
}

/**
 * Every `data-slot` a module writes, through the same grammar the `fuse/declared-density-role`
 * rule reads: a `data-slot` or `dataSlot` JSX attribute, and a `data-slot`, `dataSlot` or `slot`
 * object key, which covers prop objects and the `useRender` state Base UI stamps as `data-slot`.
 * The docs' theme studio indexes slots with it, so the index and the density table cover the same
 * slots.
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
  const note = (slot: string | undefined): void => {
    if (slot !== undefined) slots.push(slot);
  };
  new Visitor({
    JSXAttribute: (attribute) => note(jsxAttributeSlot(attribute)),
    Property: (property) => note(propertySlot(property)),
  }).visit(parsed.program);
  return slots;
}
