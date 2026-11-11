import { ruleTester } from "../rule-tester.ts";
import { noUseClient } from "./no-use-client.ts";

ruleTester.run("no-use-client", noUseClient, {
  valid: [
    'import { DialogRoot } from "./dialog";\nexport const Dialog = { Root: DialogRoot };',
    '"use strict";\nexport const scale = 1;',
    'const label = "use client";',
  ],
  invalid: [
    {
      code: '"use client";\nimport { DialogRoot } from "./dialog";\nexport const Dialog = { Root: DialogRoot };',
      errors: [{ messageId: "directive" }],
    },
    { code: "'use client';\nexport const scale = 1;", errors: [{ messageId: "directive" }] },
  ],
});
