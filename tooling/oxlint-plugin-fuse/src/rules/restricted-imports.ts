import type { ESTree, Rule } from "@oxlint/plugins";
import { dirname, resolve } from "node:path";

import { anyViolates } from "../quantify.ts";
import { evaluate, propertyName } from "../resolve.ts";
import type { Alt } from "../resolve.ts";
import { requiredOptions } from "../rule-options.ts";
import { isTestFile } from "../source-file.ts";
import { constantString } from "../static-text.ts";

/** One configured module: a pattern its normalised specifier is matched against, why, and which exports. */
type RestrictedModule = {
  readonly pattern: string;
  readonly message: string;
  /** The exports restricted; every import of the module when absent. */
  readonly names?: ReadonlyArray<string>;
};

/** The rule's options: the modules, and whether test files are checked too. */
type RestrictedImportsOptions = {
  readonly modules: ReadonlyArray<RestrictedModule>;
  readonly tests?: "skip" | "check";
};

/** A configured module with its pattern compiled. */
type Restriction = {
  readonly pattern: RegExp;
  readonly message: string;
  readonly names: ReadonlySet<string> | undefined;
};

/**
 * Modules import none of the configured modules, type-only imports included, by any static
 * import, re-export (named, `*` or `* as`), `import x = require(…)` or dynamic `import()` whose
 * specifier is a constant. A relative specifier is matched as the path it resolves to from the
 * importing file, so `./generate-exports`, `../scripts/generate-exports.ts` and
 * `./lib/../generate-exports` are one module. A module configured with `names` restricts only
 * those exports, however they are reached: a named import or re-export, `export *`, a member of a
 * namespace or of a dynamic `import()`, or a key destructured from one, through `resolve.ts`.
 * Over the built-in `no-restricted-imports` it adds the dynamic and normalised forms; it skips test
 * files, which may import anything they check, unless `tests` is `"check"`; and each config
 * override sets its own list, matched by pattern. An override's options replace the package-wide
 * list, so an override restates every entry it keeps.
 *
 * Scope: follows what `resolve.ts` follows, for a namespace and a dynamic import. Beyond that: a
 * module handed to a callback (`import(x).then((module) => module.name)`) is not followed.
 */
export const restrictedImports: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid configured modules, or configured exports of them." },
    messages: { restricted: "Do not import {{specifier}} here: {{reason}}" },
    schema: [
      {
        type: "object",
        properties: {
          modules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pattern: { type: "string" },
                message: { type: "string" },
                names: { type: "array", items: { type: "string" } },
              },
              required: ["pattern", "message"],
              additionalProperties: false,
            },
          },
          tests: { enum: ["skip", "check"] },
        },
        required: ["modules"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = requiredOptions<RestrictedImportsOptions>(context);
    if (options.tests !== "check" && isTestFile(context.filename)) return {};
    const restrictions: Restriction[] = options.modules.map(({ pattern, message, names }) => ({
      pattern: new RegExp(pattern, "u"),
      message,
      names: names === undefined ? undefined : new Set(names),
    }));

    /** A specifier as matched: a relative one resolved from the importing file, a bare one as written. */
    const normalised = (specifier: string): string =>
      specifier.startsWith("./") || specifier.startsWith("../")
        ? resolve(dirname(context.filename), specifier).replaceAll("\\", "/")
        : specifier;

    /** The restrictions a specifier falls under. */
    const restrictionsOf = (specifier: string): Restriction[] =>
      restrictions.filter(({ pattern }) => pattern.test(normalised(specifier)));

    const report = (node: ESTree.Node, specifier: string, restriction: Restriction): void => {
      context.report({ node, messageId: "restricted", data: { specifier, reason: restriction.message } });
    };

    /**
     * Check a module reference. `imported` lists the exports it takes by name; `"all"` takes every
     * export (`export *`); `"namespace"` takes the module object, whose members are checked where
     * they are read.
     */
    const check = (
      source: ESTree.Node | null,
      imported: ReadonlyArray<string> | "all" | "namespace"
    ): void => {
      if (source === null) return;
      const specifier = constantString(source);
      if (specifier === undefined) return;
      for (const restriction of restrictionsOf(specifier)) {
        const names = restriction.names;
        const taken =
          names === undefined ||
          imported === "all" ||
          (imported !== "namespace" && imported.some((name) => names.has(name)));
        if (taken) {
          report(source, specifier, restriction);
          return;
        }
      }
    };

    /** Whether one alternative is a restricted export of a restricted module, and which restriction. */
    const restrictedExport = (
      alternative: Alt
    ): { readonly specifier: string; readonly restriction: Restriction } | undefined => {
      if (alternative.kind !== "import") return undefined;
      for (const restriction of restrictionsOf(alternative.source)) {
        if (restriction.names?.has(alternative.imported) === true)
          return { specifier: alternative.source, restriction };
      }
      return undefined;
    };

    /** Report a value any alternative of which is a restricted export. */
    const checkValue = (node: ESTree.Node, value: ESTree.Node): void => {
      const values = evaluate(context, value);
      if (!anyViolates(values, (alternative) => restrictedExport(alternative) !== undefined)) return;
      // The report names the first restricted alternative.
      const hit = values.map(restrictedExport).find((found) => found !== undefined);
      if (hit !== undefined) report(node, hit.specifier, hit.restriction);
    };

    const exportedNames = (specifiers: ReadonlyArray<ESTree.Node>): string[] =>
      specifiers.flatMap((specifier) => {
        if (specifier.type === "ImportSpecifier") {
          const name = specifier.imported;
          return [name.type === "Identifier" ? name.name : name.value];
        }
        if (specifier.type === "ExportSpecifier") {
          const name = specifier.local;
          return [name.type === "Identifier" ? name.name : name.value];
        }
        return [];
      });

    return {
      ImportDeclaration: (node) => check(node.source, exportedNames(node.specifiers)),
      ExportNamedDeclaration: (node) => check(node.source, exportedNames(node.specifiers)),
      ExportAllDeclaration: (node) => check(node.source, "all"),
      ImportExpression: (node) => check(node.source, "namespace"),
      TSImportEqualsDeclaration: (node) => {
        if (node.moduleReference.type === "TSExternalModuleReference") {
          check(node.moduleReference.expression, "namespace");
        }
      },
      MemberExpression: (node) => checkValue(node, node),
      VariableDeclarator: (node) => {
        if (node.id.type !== "ObjectPattern" || node.init === null) return;
        const values = evaluate(context, node.init);
        for (const property of node.id.properties) {
          const key = property.type === "Property" ? propertyName(property) : undefined;
          if (key === undefined) continue;
          // A key destructured from a namespace is that export.
          const exportOf = (alternative: Alt) =>
            alternative.kind === "import" && alternative.imported === "*"
              ? restrictedExport({ ...alternative, imported: key })
              : undefined;
          if (!anyViolates(values, (alternative) => exportOf(alternative) !== undefined)) continue;
          // The report names the first restricted alternative.
          const hit = values.map(exportOf).find((found) => found !== undefined);
          if (hit !== undefined) report(property, hit.specifier, hit.restriction);
        }
      },
    };
  },
};
