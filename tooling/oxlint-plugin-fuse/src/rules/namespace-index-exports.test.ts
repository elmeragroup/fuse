import { ruleTester } from "../rule-tester.ts";
import { namespaceIndexExports } from "./namespace-index-exports.ts";

ruleTester.run("namespace-index-exports", namespaceIndexExports, {
  valid: [
    'import { DialogRoot, DialogTitle } from "./dialog";\nexport const Dialog = { Root: DialogRoot, Title: DialogTitle };',
    'import { DateInputRoot } from "./date-input";\nexport const DateInput = { Root: DateInputRoot };\nexport { DateField } from "./date-field";',
  ],
  invalid: [
    {
      code: 'export const Dialog = {};\nexport { useDialog } from "./dialog";',
      errors: [{ messageId: "export" }],
    },
    {
      code: 'export const Dialog = {};\nexport type { DialogProps } from "./dialog";',
      errors: [{ messageId: "export" }],
    },
    {
      code: 'export const Dialog = {};\nexport { DIALOG_SIZES } from "./dialog";',
      errors: [{ messageId: "export" }],
    },
    {
      code: "export const Dialog = {}, Sheet = {};",
      errors: [{ messageId: "namespace" }, { messageId: "export" }],
    },
    { code: 'export * from "./dialog";', errors: [{ messageId: "namespace" }, { messageId: "export" }] },
    { code: "const Dialog = {};", errors: [{ messageId: "namespace" }] },
    {
      code: "export const Dialog = {};\nexport const Sheet = {};",
      errors: [{ messageId: "namespace" }],
    },
  ],
});
