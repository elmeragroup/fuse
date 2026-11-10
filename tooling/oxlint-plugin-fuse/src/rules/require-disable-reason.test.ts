import { ruleTester } from "../rule-tester.ts";
import { requireDisableReason } from "./require-disable-reason.ts";

ruleTester.run("require-disable-reason", requireDisableReason, {
  valid: [
    "// oxlint-disable-next-line no-console -- prints the CLI's usage text\nconsole.log(1);",
    "/* eslint-disable no-console -- this script reports to the terminal */",
    "const node = <div>{/* oxlint-disable-next-line no-alert -- the demo shows a native alert */}</div>;",
    "// A note that mentions oxlint-disable in prose is not a directive.",
  ],
  invalid: [
    { code: "// oxlint-disable-next-line no-console\nconsole.log(1);", errors: [{ messageId: "missing" }] },
    {
      code: "// eslint-disable-line no-console -- needed\nconsole.log(1);",
      errors: [{ messageId: "missing" }],
    },
    { code: "/* oxlint-disable */", errors: [{ messageId: "missing" }] },
    {
      code: "const node = <div>{/* oxlint-disable-next-line no-alert -- */}</div>;",
      errors: [{ messageId: "missing" }],
    },
  ],
});
