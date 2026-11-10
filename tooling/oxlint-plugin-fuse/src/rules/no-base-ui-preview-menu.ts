import type { ESTree, Rule } from "@oxlint/plugins";

/** Base UI `Menu` members that are still preview APIs. */
const PREVIEW_MEMBERS: ReadonlySet<string> = new Set([
  "FilterProvider",
  "Input",
  "List",
  "Clear",
  "Empty",
  "useFilter",
]);

/** The entries that export Base UI's `Menu`: its own subpath and the package root. */
const MENU_SOURCES: ReadonlySet<string> = new Set(["@base-ui/react/menu", "@base-ui/react"]);

/**
 * Base UI's preview `Menu` filtering members (`Menu.FilterProvider`, `Menu.Input`, `Menu.List`,
 * `Menu.Clear`, `Menu.Empty`, `Menu.useFilter`) are read in one module, the data table filter's
 * `searchable-menu.ts`, which the config exempts. Base UI renames preview APIs on their way out of
 * preview, so one owner keeps a rename to one edit. Reads through any alias of `Menu`, in code, JSX
 * and types, all count.
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
    const aliases = new Set<string>();
    const note = (node: ESTree.Node, object: string, member: string): void => {
      if (aliases.has(object) && PREVIEW_MEMBERS.has(member)) {
        context.report({ node, messageId: "preview", data: { read: `${object}.${member}` } });
      }
    };
    return {
      ImportDeclaration(declaration) {
        if (!MENU_SOURCES.has(declaration.source.value)) return;
        for (const specifier of declaration.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported =
            specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name;
          if (imported === "Menu") aliases.add(specifier.local.name);
        }
      },
      MemberExpression(node) {
        if (node.object.type === "Identifier" && !node.computed && node.property.type === "Identifier") {
          note(node, node.object.name, node.property.name);
        }
      },
      JSXMemberExpression(node) {
        if (node.object.type === "JSXIdentifier") note(node, node.object.name, node.property.name);
      },
      TSQualifiedName(node) {
        if (node.left.type === "Identifier") note(node, node.left.name, node.right.name);
      },
    };
  },
};
