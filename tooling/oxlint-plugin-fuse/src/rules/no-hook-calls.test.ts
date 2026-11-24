import { ruleTester } from "../rule-tester.ts";
import { noHookCalls } from "./no-hook-calls.ts";

ruleTester.run("no-hook-calls", noHookCalls, {
  valid: [
    // A namespace import used only for createElement, and a hook's type, are no hook calls.
    'import * as React from "react";\nexport const Mark = () => React.createElement("svg", { "aria-hidden": true });',
    'import type { useState } from "react";\ntype Setter = ReturnType<typeof useState>[1];\nexport const draw = (set: Setter) => set;',
    // A name that only starts with "use" is no hook.
    "const user = 1;\nuseless();\nexport const value = user;",
  ],
  invalid: [
    // A callee that may be a hook calls one.
    {
      code: "(flag ? useState : noop)(0);",
      errors: [{ messageId: "hook" }],
    },
    {
      code: 'import { useState } from "react";\nexport function Mark() {\n  const [value] = useState(0);\n  return value;\n}',
      errors: [{ messageId: "hook", data: { name: "useState" } }],
    },
    // A hook called off a namespace import.
    {
      code: 'import * as React from "react";\nexport function Mark() {\n  return React.useId();\n}',
      errors: [{ messageId: "hook", data: { name: "useId" } }],
    },
    // A module path read only in part is one unknown module, so it cannot push the hook past the
    // evaluator's cap, and a hook read off it is still a hook.
    {
      code: 'import * as React from "react";\nexport async function Mark(base: string, a: boolean) {\n  const pick = (flag: boolean) => (flag ? "x" : "y");\n  const local = `./${base}`.concat(pick(a), pick(a), pick(a), pick(a), pick(a), pick(a));\n  const hooks = a ? React : await import(local);\n  const makeId = hooks.useId;\n  return makeId();\n}',
      errors: [{ messageId: "hook", data: { name: "useId" } }],
    },
    {
      code: 'import { use } from "react";\nexport const read = (p) => use(p);',
      errors: [{ messageId: "hook", data: { name: "use" } }],
    },
    {
      code: 'import { useLocale as locale } from "../../intl/locale-context";\nexport const Mark = () => locale();',
      errors: [{ messageId: "hook", data: { name: "useLocale" } }],
    },
  ],
});
