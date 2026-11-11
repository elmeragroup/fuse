import type { ESTree, Rule } from "@oxlint/plugins";

/** A component name: PascalCase, unlike a hook (`useX`) or a constant (`X_Y`). */
const COMPONENT_NAME = /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*$/u;

/** Whether a statement is `export const Name = …` with one declarator: the namespace object. */
function isNamespaceObject(statement: ESTree.Statement | ESTree.Directive): boolean {
  return (
    statement.type === "ExportNamedDeclaration" &&
    statement.declaration?.type === "VariableDeclaration" &&
    statement.declaration.declarations.length === 1
  );
}

/** Whether a statement re-exports only component values, as a labeled composite beside its namespace. */
function isComponentReexport(statement: ESTree.Statement | ESTree.Directive): boolean {
  return (
    statement.type === "ExportNamedDeclaration" &&
    statement.declaration === null &&
    statement.source !== null &&
    statement.exportKind !== "type" &&
    statement.specifiers.every(
      (specifier) =>
        specifier.exportKind !== "type" &&
        specifier.exported.type === "Identifier" &&
        COMPONENT_NAME.test(specifier.exported.name)
    )
  );
}

/** Whether a statement adds to the module's exports. */
function isExport(statement: ESTree.Statement | ESTree.Directive): boolean {
  return (
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration" ||
    statement.type === "ExportAllDeclaration" ||
    statement.type === "TSExportAssignment"
  );
}

/**
 * A component's namespace index exports its one namespace object, `export const Name = { … }`,
 * and at most re-exports components such as a labeled composite (`DateField` beside
 * `DateInput`). Which module owns a hook, constant or prop type is the implementation module's
 * decision, so the entry facade imports those from there, and the index stays the
 * server-visible namespace.
 */
export const namespaceIndexExports: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Limit a namespace index to its namespace object and component re-exports." },
    messages: {
      namespace: "A namespace index exports exactly one namespace object, as `export const Name = { … }`.",
      export:
        "A namespace index exports its namespace object and re-exports components only. Export hooks, constants and types from the implementation module.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        const exports = program.body.filter(isExport);
        const namespaces = exports.filter(isNamespaceObject);
        if (namespaces.length !== 1) context.report({ node: program, messageId: "namespace" });
        for (const statement of exports) {
          if (!isNamespaceObject(statement) && !isComponentReexport(statement)) {
            context.report({ node: statement, messageId: "export" });
          }
        }
      },
    };
  },
};
