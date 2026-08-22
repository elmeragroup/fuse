import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import noRacOutsideQuarantine from "./no-rac-outside-quarantine.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "quarantined" };

tester.run("elmera/no-rac-outside-quarantine", noRacOutsideQuarantine, {
  valid: [
    {
      name: "react-aria-components inside quarantine",
      filename: "packages/ui/src/react-aria/calendar.ts",
      code: `import { Calendar } from "react-aria-components";
`,
    },
    {
      name: "react-aria inside quarantine",
      filename: "packages/ui/src/react-aria/focusable.ts",
      code: `import { useFocusable } from "react-aria";
`,
    },
    {
      name: "@internationalized/date inside quarantine",
      filename: "packages/ui/src/react-aria/date-field.ts",
      code: `import { parseDate } from "@internationalized/date";
`,
    },
    {
      name: "unrelated import in components",
      filename: "packages/ui/src/components/button/button.tsx",
      code: `import { Button as ButtonPrimitive } from "@base-ui/react/button";
`,
    },
    {
      name: "scoped @react-aria inside quarantine",
      filename: "packages/ui/src/react-aria/focusable.ts",
      code: `import { useFocusable } from "@react-aria/focus";
`,
    },
  ],
  invalid: [
    {
      name: "react-aria-components from components",
      filename: "packages/ui/src/components/select/select.tsx",
      code: `import { Select } from "react-aria-components";
`,
      errors: [error],
    },
    {
      name: "react-aria from components",
      filename: "packages/ui/src/components/button/button.tsx",
      code: `import { useFocusable } from "react-aria";
`,
      errors: [error],
    },
    {
      name: "@internationalized/date from components",
      filename: "packages/ui/src/components/input/input.tsx",
      code: `import { parseDate } from "@internationalized/date";
`,
      errors: [error],
    },
    {
      name: "scoped @react-aria from components",
      filename: "packages/ui/src/components/button/button.tsx",
      code: `import { useButton } from "@react-aria/button";
`,
      errors: [error],
    },
    {
      name: "scoped @react-stately from components",
      filename: "packages/ui/src/components/select/select.tsx",
      code: `import { useSelectState } from "@react-stately/select";
`,
      errors: [error],
    },
  ],
});
