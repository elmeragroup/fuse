import { ruleTester } from "../rule-tester.ts";
import { restrictedImports } from "./restricted-imports.ts";

const options = [
  {
    modules: [
      {
        pattern: "(?:^|/)temporal-polyfill(?:\\.[cm]?[jt]sx?)?(?:/|$)",
        message: "only the installer entry loads the polyfill.",
      },
      { pattern: "^@elmeragroup/color(?:/|$)", message: "the Temporal core stays self-contained." },
    ],
  },
];

const writer = [
  {
    modules: [
      {
        pattern: "(?:^|/)packages/fuse/scripts/generate-exports(?:\\.[cm]?[jt]sx?)?$",
        names: ["writeSourceExports"],
        message: "only the exports script writes the tracked exports.",
      },
    ],
  },
];

const BUILD = "/repo/packages/fuse/scripts/build.ts";

/**
 * A condition chain on `flag` that holds one of `values`: as many alternatives as there are values.
 *
 * @param flag - The condition's name.
 * @param values - The strings, at least one.
 * @returns The chain's source.
 */
const oneOf = (flag: string, values: ReadonlyArray<string>): string =>
  values
    .map((value, index) => (index < values.length - 1 ? `${flag} ? "${value}" : ` : `"${value}"`))
    .join("");

ruleTester.run("restricted-imports: named exports", restrictedImports, {
  valid: [
    // Another export of the writer's module stays allowed, by any access.
    { code: 'import { writePublishManifest } from "./generate-exports";', options: writer, filename: BUILD },
    {
      code: 'import * as exportsScript from "./generate-exports";\nexportsScript.writePublishManifest();',
      options: writer,
      filename: BUILD,
    },
    {
      code: 'const { writePublishManifest } = await import("./generate-exports.ts");',
      options: writer,
      filename: BUILD,
    },
    { code: 'export { writePublishManifest } from "./generate-exports";', options: writer, filename: BUILD },
    // An `import("…")` type of another export stays allowed.
    {
      code: 'type Write = typeof import("./generate-exports").writePublishManifest;',
      options: writer,
      filename: BUILD,
    },
    // A module of the same name elsewhere is another module.
    {
      code: 'import { writeSourceExports } from "./lib/generate-exports";',
      options: writer,
      filename: BUILD,
    },
  ],
  invalid: [
    {
      code: 'import { writeSourceExports } from "./generate-exports";',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    // A relative path that resolves to the writer's module is the writer's module.
    {
      code: 'import { writeSourceExports } from "../scripts/generate-exports.ts";',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'import { writeSourceExports as write } from "./lib/../generate-exports.mjs";',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    // A key destructured from a dynamic import.
    {
      code: 'const { writeSourceExports } = await import("./generate-exports.ts");',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'const exportsScript = await import("./generate-exports");\nexportsScript.writeSourceExports(root);',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    // A specifier read only in part is one unknown specifier, however many ways its parts may
    // spell, so it cannot push the writer's module past the evaluator's cap.
    {
      code: 'async function load(base: string, a: boolean) {\n  const pick = (flag: boolean) => (flag ? "x" : "y");\n  const local = `./${base}`.concat(pick(a), pick(a), pick(a), pick(a), pick(a), pick(a));\n  const exportsScript = await import(a ? "./generate-exports" : local);\n  exportsScript.writeSourceExports(root);\n}',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'async function load(base: string, a: boolean) {\n  const pick = (flag: boolean) => (flag ? "x" : "y");\n  const local = `./${base}`.concat(pick(a), pick(a), pick(a), pick(a), pick(a), pick(a));\n  const exportsScript = a ? await import("./generate-exports") : await import(local);\n  exportsScript.writeSourceExports(root);\n}',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    // Two prefixes and 32 suffixes make exactly the evaluator's 64 combinations.
    {
      code: `async function load(base: string, a: boolean) {\n  const prefix = a ? "./generate" : \`./\${base}\`.concat(a ? "a" : "b");\n  const exportsScript = await import(prefix + (${oneOf("a", ["-exports", ...Array.from({ length: 31 }, (_, index) => `-${index}`)])}));\n  exportsScript.writeSourceExports(root);\n}`,
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'async function load(parts: string[], a: boolean, b: boolean) {\n  const local = [...parts, a ? "a" : "b", a ? "a" : "b", a ? "a" : "b", a ? "a" : "b", a ? "a" : "b"].join("/");\n  const exportsScript = await import((b ? "./generate-exports" : local) + (a ? ".ts" : ""));\n  exportsScript.writeSourceExports(root);\n}',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: '(await import("./generate-exports"))["writeSourceExports"](root);',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'import * as exportsScript from "./generate-exports";\nexportsScript.writeSourceExports(root);',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    // An `import("…")` type takes the export its qualifier starts with.
    {
      code: 'type Write = typeof import("./generate-exports").writeSourceExports;',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    // Re-exports hand the writer on.
    {
      code: 'export { writeSourceExports } from "./generate-exports";',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'export * from "./generate-exports";',
      options: writer,
      filename: BUILD,
      errors: [{ messageId: "restricted" }],
    },
  ],
});

ruleTester.run("restricted-imports: test files", restrictedImports, {
  valid: [{ code: 'import "../../temporal-polyfill";', options, filename: "date-picker.browser.test.tsx" }],
  invalid: [
    {
      code: 'import "../../temporal-polyfill";',
      options: [{ ...options[0], tests: "check" }],
      filename: "date-picker.browser.test.tsx",
      errors: [{ messageId: "restricted" }],
    },
  ],
});

ruleTester.run("restricted-imports", restrictedImports, {
  valid: [
    { code: 'import { Temporal } from "temporal-polyfill-lite";', options },
    { code: 'import { today } from "./temporal/today";', options },
    { code: 'import "../../temporal-polyfill";', options, filename: "date-picker.browser.test.tsx" },
    { code: "const module = await import(path);", options },
    // A `require` the module declares is its own function, and a computed specifier names no module.
    { code: 'function load(require) {\n  return require("temporal-polyfill");\n}', options },
    { code: "const module = require(path);", options },
  ],
  invalid: [
    { code: 'import "../../temporal-polyfill";', options, errors: [{ messageId: "restricted" }] },
    { code: 'import "../temporal-polyfill.ts";', options, errors: [{ messageId: "restricted" }] },
    { code: 'import "../temporal-polyfill.js";', options, errors: [{ messageId: "restricted" }] },
    {
      code: 'const polyfill = require("temporal-polyfill");',
      options,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'type Now = import("temporal-polyfill").Temporal.Instant;',
      options,
      errors: [{ messageId: "restricted" }],
    },
    { code: 'import { Temporal } from "temporal-polyfill";', options, errors: [{ messageId: "restricted" }] },
    { code: 'export * from "temporal-polyfill/global";', options, errors: [{ messageId: "restricted" }] },
    {
      code: 'const polyfill = import("../temporal-polyfill");',
      options,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'import type { Hex } from "@elmeragroup/color/hex";',
      options,
      errors: [{ messageId: "restricted" }],
    },
    {
      code: 'export { parse } from "@elmeragroup/color/oklch";',
      options,
      errors: [{ messageId: "restricted" }],
    },
    { code: 'export * as Color from "@elmeragroup/color";', options, errors: [{ messageId: "restricted" }] },
    {
      code: 'import polyfill = require("temporal-polyfill");',
      options,
      filename: "module.ts",
      errors: [{ messageId: "restricted" }],
    },
  ],
});
