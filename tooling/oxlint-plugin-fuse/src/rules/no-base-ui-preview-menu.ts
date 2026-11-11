import type { ESTree, Rule } from "@oxlint/plugins";

import { nameChain } from "../ast-names.ts";
import { baseUiBindings, baseUiReference, noteBaseUiImport } from "../base-ui-import.ts";

/** Base UI `Menu` members that are still preview APIs. */
const PREVIEW_MEMBERS: ReadonlySet<string> = new Set([
  "FilterProvider",
  "Input",
  "List",
  "Clear",
  "Empty",
  "useFilter",
]);

/**
 * Base UI's preview `Menu` filtering members (`Menu.FilterProvider`, `Menu.Input`, `Menu.List`,
 * `Menu.Clear`, `Menu.Empty`, `Menu.useFilter`) are read in one module, the data table filter's
 * `searchable-menu.ts`, which the config exempts. Base UI renames preview APIs on their way out of
 * preview, so one owner keeps a rename to one edit. Reads through any alias of `Menu` from its
 * subpath or the package root, or through a namespace import, in code, JSX and types, all count.
 */
export const noBaseUiPreviewMenu: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Confine Base UI's preview Menu members to their owner module." },
    messages: {
      preview:
        "{{read}} is a Base UI preview API. Read it only in data-table-filter/searchable-menu.ts, so an upstream rename is one edit.",
    },
    schema: [],
  },
  create(context) {
    const bindings = baseUiBindings();
    const note = (node: ESTree.Node, segments: readonly string[] | undefined): void => {
      if (segments === undefined) return;
      const reference = baseUiReference(segments, bindings);
      if (reference?.exported !== "Menu" || reference.member === undefined) return;
      if (PREVIEW_MEMBERS.has(reference.member)) {
        context.report({ node, messageId: "preview", data: { read: segments.join(".") } });
      }
    };
    return {
      ImportDeclaration(declaration) {
        noteBaseUiImport(declaration, bindings, "values-and-types");
      },
      MemberExpression(node) {
        note(node, nameChain(node));
      },
      JSXMemberExpression(node) {
        note(node, nameChain(node));
      },
      TSQualifiedName(node) {
        note(node, nameChain(node));
      },
    };
  },
};
