// Adapted from kumo lint/enforce-variant-standard.js (MIT, Copyright (c) 2026 Cloudflare, Inc.).
import { defineRule } from "@oxlint/plugins";

/**
 * @param {string} filename
 */
function normalizeFilename(filename) {
  return filename.replaceAll("\\", "/");
}

/**
 * Component entry: src/components/<name>/<name>.tsx
 * @param {string} filename
 */
function isComponentEntry(filename) {
  return /(?:^|\/)src\/components\/([^/]+)\/\1\.tsx$/.test(normalizeFilename(filename));
}

/**
 * Colocated recipe module: src/components/<name>/<name>-variants.ts
 * @param {string} filename
 */
function isVariantsModule(filename) {
  return /(?:^|\/)src\/components\/([^/]+)\/\1-variants\.ts$/.test(normalizeFilename(filename));
}

/**
 * @param {import("estree").Node | null | undefined} callee
 */
function isTvCall(callee) {
  return callee?.type === "Identifier" && callee.name === "tv";
}

/**
 * @param {import("estree").ObjectExpression} obj
 * @param {string} name
 */
function objectHasProp(obj, name) {
  return obj.properties.some((prop) => {
    if (prop.type !== "Property") return false;
    if (prop.key.type === "Identifier") return prop.key.name === name;
    return prop.key.type === "Literal" && prop.key.value === name;
  });
}

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce tv recipe structure: named recipe, variants/defaultVariants shape, VariantProps typing",
    },
    messages: {
      unnamedRecipe: "tv() recipes must be assigned to a named const (e.g. buttonVariants).",
      inlineObject: "tv() must receive an inline object with variants and defaultVariants.",
      missingVariants: "tv() recipe '{{name}}' must declare a variants object.",
      missingDefaultVariants: "tv() recipe '{{name}}' must declare defaultVariants.",
      missingVariantProps:
        "Component files that define a tv() recipe must type props with VariantProps<typeof recipe>.",
    },
    schema: [],
  },
  defaultOptions: [],
  createOnce(context) {
    let shouldCheck = false;
    let requireVariantProps = false;
    /** @type {import("estree").CallExpression[]} */
    const tvCalls = [];

    return {
      Program() {
        const filename = context.filename;
        shouldCheck = isComponentEntry(filename) || isVariantsModule(filename);
        requireVariantProps = isComponentEntry(filename);
        tvCalls.length = 0;
      },
      CallExpression(node) {
        if (!shouldCheck || !isTvCall(node.callee)) return;
        tvCalls.push(node);
      },
      "Program:exit"() {
        if (!shouldCheck || tvCalls.length === 0) return;

        for (const node of tvCalls) {
          const parent = node.parent;
          const named =
            parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" ? parent.id.name : null;

          if (!named) {
            context.report({ node, messageId: "unnamedRecipe" });
            continue;
          }

          const firstArg = node.arguments[0];
          if (firstArg?.type !== "ObjectExpression") {
            context.report({ node, messageId: "inlineObject" });
            continue;
          }

          if (!objectHasProp(firstArg, "variants")) {
            context.report({
              node,
              messageId: "missingVariants",
              data: { name: named },
            });
          }

          if (!objectHasProp(firstArg, "defaultVariants")) {
            context.report({
              node,
              messageId: "missingDefaultVariants",
              data: { name: named },
            });
          }
        }

        if (requireVariantProps && !context.sourceCode.getText().includes("VariantProps")) {
          context.report({
            loc: tvCalls[0]?.loc,
            messageId: "missingVariantProps",
          });
        }
      },
    };
  },
});
