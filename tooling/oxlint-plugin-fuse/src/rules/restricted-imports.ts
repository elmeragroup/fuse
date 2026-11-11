import type { ESTree, Rule } from "@oxlint/plugins";

import { requiredOptions } from "../rule-options.ts";
import { isTestFile } from "../source-file.ts";
import { constantString } from "../static-text.ts";

/** The configured modules: a regular expression each specifier is matched against, and why. */
type RestrictedImportsOptions = {
  readonly modules: ReadonlyArray<{ readonly pattern: string; readonly message: string }>;
};

/**
 * Library modules import none of the configured modules, type-only imports included, by any
 * static import, re-export (named, `*` or `* as`), `import x = require(…)` or dynamic import whose
 * specifier is a constant. Over the built-in `no-restricted-imports` it adds three things: it
 * catches a dynamic `import()`, so a lazy import cannot load the module either; it skips test
 * files, which may import anything they check; and each config override sets its own list, matched
 * by pattern. An override's options replace the package-wide list, so an override restates every
 * entry it keeps.
 */
export const restrictedImports: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid configured module specifiers in library (non-test) modules." },
    messages: { restricted: "Do not import {{specifier}} here: {{reason}}" },
    schema: [
      {
        type: "object",
        properties: {
          modules: {
            type: "array",
            items: {
              type: "object",
              properties: { pattern: { type: "string" }, message: { type: "string" } },
              required: ["pattern", "message"],
              additionalProperties: false,
            },
          },
        },
        required: ["modules"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const restrictions = requiredOptions<RestrictedImportsOptions>(context).modules.map(
      ({ pattern, message }) => ({ pattern: new RegExp(pattern, "u"), message })
    );
    const check = (source: ESTree.Node | null): void => {
      if (source === null) return;
      const specifier = constantString(source);
      if (specifier === undefined) return;
      const restriction = restrictions.find(({ pattern }) => pattern.test(specifier));
      if (restriction === undefined) return;
      context.report({
        node: source,
        messageId: "restricted",
        data: { specifier, reason: restriction.message },
      });
    };
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      TSImportEqualsDeclaration: (node) => {
        if (node.moduleReference.type === "TSExternalModuleReference") check(node.moduleReference.expression);
      },
    };
  },
};
