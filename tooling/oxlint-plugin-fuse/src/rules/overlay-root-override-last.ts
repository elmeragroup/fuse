import type { ESTree, Rule } from "@oxlint/plugins";

/** The Base UI primitives whose Root locks the page's scroll from the root itself, open or not shown. */
const SCROLL_LOCKING_ROOTS: ReadonlySet<string> = new Set([
  "@base-ui/react/alert-dialog",
  "@base-ui/react/dialog",
  "@base-ui/react/drawer",
]);

/** The module that owns the overlay root override, as an import source ends with it. */
const OVERRIDE_MODULE = "/internal/overlay-exclusion";

/** The hook that module exports. */
const OVERRIDE_HOOK = "useOverlayRootOverride";

/**
 * Every `<Primitive.Root>` of a scroll-locking Base UI primitive (Dialog, AlertDialog, Drawer)
 * spreads the overlay root override as its last attribute: a binding the module initialises by
 * calling `useOverlayRootOverride`, matched through its import under any local name. A root that
 * skips it keeps a SkeletonReveal's ghost locking the page while nothing shows.
 */
export const overlayRootOverrideLast: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require the overlay root override as the last spread on scroll-locking Roots." },
    messages: {
      missing:
        "Spread the result of `useOverlayRootOverride()` as the last attribute of {{tag}}, so a hidden skeleton ghost cannot lock the page's scroll.",
    },
    schema: [],
  },
  create(context) {
    const primitives = new Set<string>();
    const overrideHooks = new Set<string>();
    const overrides = new Set<string>();
    const roots: ESTree.JSXOpeningElement[] = [];
    return {
      ImportDeclaration(declaration) {
        if (declaration.importKind === "type") return;
        const source = declaration.source.value;
        const fromOverride = source.endsWith(OVERRIDE_MODULE);
        if (!fromOverride && !SCROLL_LOCKING_ROOTS.has(source)) return;
        for (const specifier of declaration.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          if (!fromOverride) {
            primitives.add(specifier.local.name);
          } else if (specifier.imported.type === "Identifier" && specifier.imported.name === OVERRIDE_HOOK) {
            overrideHooks.add(specifier.local.name);
          }
        }
      },
      VariableDeclarator(declarator) {
        const init = declarator.init;
        if (
          declarator.id.type === "Identifier" &&
          init?.type === "CallExpression" &&
          init.callee.type === "Identifier" &&
          overrideHooks.has(init.callee.name)
        ) {
          overrides.add(declarator.id.name);
        }
      },
      JSXOpeningElement(element) {
        roots.push(element);
      },
      // Judged once the whole module is read, so a binding declared below its use still counts.
      "Program:exit"() {
        for (const element of roots) {
          const name = element.name;
          if (name.type !== "JSXMemberExpression" || name.property.name !== "Root") continue;
          if (name.object.type !== "JSXIdentifier" || !primitives.has(name.object.name)) continue;
          const last = element.attributes.at(-1);
          const overridden =
            last?.type === "JSXSpreadAttribute" &&
            last.argument.type === "Identifier" &&
            overrides.has(last.argument.name);
          if (!overridden) {
            context.report({
              node: element,
              messageId: "missing",
              data: { tag: `${name.object.name}.Root` },
            });
          }
        }
      },
    };
  },
};
