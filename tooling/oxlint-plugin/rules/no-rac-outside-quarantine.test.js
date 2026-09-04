import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_RAC_PACKAGES } from "../../../packages/ui/scripts/forbidden-rac-packages.js";
import { createRuleTester } from "../rule-tester.js";
import noRacOutsideQuarantine from "./no-rac-outside-quarantine.js";

const tester = createRuleTester();
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
    {
      name: "dynamic import inside quarantine",
      filename: "packages/ui/src/react-aria/calendar.ts",
      code: `const load = () => import("react-aria-components");
`,
    },
    {
      name: "dynamic import of an allowed module in components",
      filename: "packages/ui/src/components/button/button.tsx",
      code: `const load = () => import("@base-ui/react/button");
`,
    },
    {
      name: "computed dynamic import is not a specifier",
      filename: "packages/ui/src/components/select/select.tsx",
      code: `const load = (path) => import(path);
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
    {
      name: "dynamic import of react-aria-components from components",
      filename: "packages/ui/src/components/select/select.tsx",
      code: `const load = () => import("react-aria-components");
`,
      errors: [error],
    },
  ],
});

describe("shared RAC forbidden list", () => {
  it("imports the shared list rather than a hand-copied array", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "no-rac-outside-quarantine.js"),
      "utf8"
    );
    expect(source).toContain("isForbiddenRacSpecifier");
    expect(source).toContain("forbidden-rac-packages.js");
    expect(source).not.toMatch(/const FORBIDDEN = \[/);
    expect(source).not.toContain("for (const name of FORBIDDEN");
    expect([...FORBIDDEN_RAC_PACKAGES]).toEqual([
      "react-aria-components",
      "react-aria",
      "@internationalized/date",
      "@react-aria",
      "@react-stately",
    ]);
  });

  it("fails a planted local copy that diverges from the shared list", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "no-rac-outside-quarantine.js"),
      "utf8"
    );
    const planted = `const FORBIDDEN = ${JSON.stringify(["react-aria-components", "react-aria"])};`;
    expect(source).not.toContain(planted);
    expect(source.includes("isForbiddenRacSpecifier") && !source.includes("const FORBIDDEN = [")).toBe(true);
  });
});
