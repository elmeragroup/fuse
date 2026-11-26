import type { ESTree, Rule } from "@oxlint/plugins";

import { propertyKeyName } from "../ast-names.ts";
import { unwrap } from "../ast-walk.ts";
import { jsxAttributeSlot, propertySlot, SLOT_JSX_ATTRIBUTES } from "../data-slot.ts";
import { declaredParts } from "../part-table.ts";
import { requiredOptions } from "../rule-options.ts";
import { isTestFile } from "../source-file.ts";
import { stringLiteral } from "../static-text.ts";

/** The attribute a part writes so the skeleton finds its role whatever `data-slot` it ends up with. */
const MARKER = "data-skeleton-part";

/** The roles module, relative to the linter's working directory or absolute. */
type SkeletonPartMarkerOptions = { readonly roles: string };

/**
 * A marker's value, read through braces and the wrappers `unwrap` strips, such as `satisfies`. It
 * is the part a string literal names, `null` for the literal `null`, which states that the element
 * has no role, or `undefined` for a value only a run could know.
 */
function markerName(value: ESTree.JSXAttribute["value"] | ESTree.Expression): string | null | undefined {
  if (value === null) return undefined;
  const node = unwrap(value.type === "JSXExpressionContainer" ? value.expression : value);
  if (node.type === "Literal" && node.value === null) return null;
  return stringLiteral(node);
}

/**
 * One entry of the props a part writes, in source order, where a later entry overrides an earlier
 * one. A `spread` is any entry whose keys only a run could know, such as the consumer's props.
 */
type PropsEntry =
  | { readonly kind: "spread" }
  | { readonly kind: "slot"; readonly slot: string; readonly node: ESTree.Node }
  | { readonly kind: "marker"; readonly name: string | null | undefined; readonly node: ESTree.Node };

const SPREAD: PropsEntry = { kind: "spread" };

/** Whether a call is Base UI's `mergeProps`, whose later arguments override its earlier ones. */
function isMergeProps(node: ESTree.Expression): node is ESTree.CallExpression {
  return (
    node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "mergeProps"
  );
}

/**
 * The entries of a `useRender` props value: an object literal's keys and spreads in order, with a
 * spread object literal or `mergeProps` call read through to its own entries.
 */
function propsEntries(node: ESTree.Expression): PropsEntry[] {
  if (isMergeProps(node)) {
    return node.arguments.flatMap((argument) =>
      argument.type === "SpreadElement" ? [SPREAD] : propsEntries(argument)
    );
  }
  if (node.type !== "ObjectExpression") return [SPREAD];
  return node.properties.flatMap((property): PropsEntry[] => {
    if (property.type === "SpreadElement") return propsEntries(property.argument);
    const name = propertyKeyName(property);
    if (property.computed && name === undefined) return [SPREAD];
    if (name === MARKER) {
      return [{ kind: "marker", name: markerName(property.value), node: property }];
    }
    // `slot` is `useRender` state, which cannot carry the marker, so only the attribute keys count.
    const slot = name !== undefined && SLOT_JSX_ATTRIBUTES.has(name) ? propertySlot(property) : undefined;
    return slot === undefined ? [] : [{ kind: "slot", slot, node: property }];
  });
}

/** The entries of a JSX element's attributes. */
function attributeEntries(element: ESTree.JSXOpeningElement): PropsEntry[] {
  return element.attributes.flatMap((attribute): PropsEntry[] => {
    if (attribute.type === "JSXSpreadAttribute") return [SPREAD];
    if (attribute.name.type === "JSXIdentifier" && attribute.name.name === MARKER) {
      return [{ kind: "marker", name: markerName(attribute.value), node: attribute }];
    }
    const slot = jsxAttributeSlot(attribute);
    return slot === undefined ? [] : [{ kind: "slot", slot, node: attribute }];
  });
}

/**
 * Whether a JSX element is the value of a `render` attribute. Base UI gives the render element's
 * props precedence over the part's, so its `data-slot` replaces the part's and a marker on it
 * would describe a part it no longer is.
 */
function isRenderElement(element: ESTree.JSXOpeningElement): boolean {
  const container = element.parent.parent;
  if (container?.type !== "JSXExpressionContainer") return false;
  const attribute = container.parent;
  return (
    attribute.type === "JSXAttribute" &&
    attribute.name.type === "JSXIdentifier" &&
    attribute.name.name === "render"
  );
}

/**
 * A JSX element that writes a literal `data-slot` naming a `PART_SKELETON` key also writes
 * `data-skeleton-part` with the same name, after its last spread. The skeleton reads a part's role
 * from that marker, so a part without it draws as text, a part with another part's name takes that
 * part's role, and a marker a spread comes after can be replaced by the consumer's props. A marker
 * the element writes always names the element's own literal slot, whether or not the slot has a
 * role, or is the literal `null`: a variant of a part that has no skeleton role, such as a mark
 * around the consumer's children that the skeleton should measure through, states so with
 * `data-skeleton-part={null}` after its spreads, which React leaves off the element. The `props` a `useRender` call takes follow the same rule, read through spread object
 * literals and `mergeProps` calls, where every argument after the marker's counts as a spread.
 *
 * Scope: a JSX element that is a `render` attribute's value is skipped, since its props replace the
 * part's own. A slot written through `useRender` state, a props object held in a variable, or a
 * slot chosen at runtime is not read. Test files are skipped.
 */
export const skeletonPartMarker: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every PART_SKELETON writer to write its own `data-skeleton-part` after its spreads.",
    },
    messages: {
      missing:
        'Write `data-skeleton-part={"{{slot}}" satisfies SkeletonPart}` after the spread props, so the skeleton keeps this part\'s role when a consumer replaces `data-slot`.',
      missingProperty:
        'Write `"data-skeleton-part": "{{slot}}" satisfies SkeletonPart` after the spread props and the last `mergeProps` argument, so the skeleton keeps this part\'s role when a consumer replaces `data-slot`.',
      mismatch:
        "`data-skeleton-part` names `{{marker}}`, but this part writes `data-slot` `{{slot}}`; the skeleton would take that part's role. Name `{{slot}}`.",
      beforeSpread:
        "Move `data-skeleton-part` after the last spread props and `mergeProps` argument, where a consumer's props cannot replace it.",
      table: "The skeleton role table cannot be read: {{reason}}",
    },
    schema: [
      {
        type: "object",
        properties: { roles: { type: "string" } },
        required: ["roles"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const { roles } = requiredOptions<SkeletonPartMarkerOptions>(context);
    const check = (
      entries: readonly PropsEntry[],
      missingNode: ESTree.Node | undefined,
      missing: "missing" | "missingProperty"
    ): void => {
      const slotEntry = entries.find((entry) => entry.kind === "slot");
      if (slotEntry === undefined) return;
      const { slot } = slotEntry;
      const markerIndex = entries.findLastIndex((entry) => entry.kind === "marker");
      const marker = entries[markerIndex];
      if (marker?.kind !== "marker") {
        const parts = declaredParts(context.cwd, roles, "PART_SKELETON");
        const node = missingNode ?? slotEntry.node;
        if (parts instanceof Error) {
          context.report({ node, messageId: "table", data: { reason: parts.message } });
        } else if (parts.has(slot)) {
          context.report({ node, messageId: missing, data: { slot } });
        }
        return;
      }
      if (marker.name !== null && marker.name !== slot) {
        context.report({
          node: marker.node,
          messageId: "mismatch",
          data: { marker: marker.name ?? "a runtime value", slot },
        });
      } else if (markerIndex < entries.findLastIndex((entry) => entry.kind === "spread")) {
        context.report({ node: marker.node, messageId: "beforeSpread" });
      }
    };
    return {
      JSXOpeningElement(element) {
        if (!isRenderElement(element)) check(attributeEntries(element), element, "missing");
      },
      CallExpression(call) {
        if (call.callee.type !== "Identifier" || call.callee.name !== "useRender") return;
        const [options] = call.arguments;
        if (options?.type !== "ObjectExpression") return;
        for (const property of options.properties) {
          if (property.type === "Property" && propertyKeyName(property) === "props") {
            check(propsEntries(property.value), undefined, "missingProperty");
          }
        }
      },
    };
  },
};
