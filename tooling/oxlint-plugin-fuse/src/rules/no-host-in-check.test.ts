import { ruleTester } from "../rule-tester.ts";
import { noHostInCheck } from "./no-host-in-check.ts";

ruleTester.run("no-host-in-check", noHostInCheck, {
  valid: [
    "const host = isShadowRoot(root) ? root.host : null;",
    'const named = "name" in element;',
    "const has = host in table;",
    'const label = "host";',
  ],
  invalid: [
    {
      code: 'const host = "host" in root ? root.host : null;',
      errors: [{ messageId: "hostIn" }],
    },
    {
      code: 'if (!("host" in root)) return chain;',
      errors: [{ messageId: "hostIn" }],
    },
    {
      code: 'const shadow = isFocusRoot(root) && "host" in root;',
      errors: [{ messageId: "hostIn" }],
    },
    {
      code: "const shadow = `host` in root;",
      errors: [{ messageId: "hostIn" }],
    },
    {
      code: 'const shadow = ("host" as const) in root;',
      errors: [{ messageId: "hostIn" }],
    },
  ],
});
