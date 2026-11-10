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

ruleTester.run("restricted-imports", restrictedImports, {
  valid: [
    { code: 'import { Temporal } from "temporal-polyfill-lite";', options },
    { code: 'import { today } from "./temporal/today";', options },
    { code: 'import "../../temporal-polyfill";', options, filename: "date-picker.browser.test.tsx" },
    { code: "const module = await import(path);", options },
  ],
  invalid: [
    { code: 'import "../../temporal-polyfill";', options, errors: [{ messageId: "restricted" }] },
    { code: 'import "../temporal-polyfill.ts";', options, errors: [{ messageId: "restricted" }] },
    { code: 'import "../temporal-polyfill.js";', options, errors: [{ messageId: "restricted" }] },
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
