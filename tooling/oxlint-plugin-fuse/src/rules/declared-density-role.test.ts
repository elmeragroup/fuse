import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ruleTester } from "../rule-tester.ts";
import { declaredDensityRole } from "./declared-density-role.ts";

const directory = mkdtempSync(join(tmpdir(), "fuse-density-roles-"));
const roles = join(directory, "density-roles.ts");
writeFileSync(
  roles,
  `export const PART_DENSITY = {
  "button": "control",
  "card-header": "surface",
  "sidebar-group:where([data-collapsible=icon] *)": "fixed",
} as const satisfies Readonly<Record<string, string>>;
`
);
const options = [{ roles }];

ruleTester.run("declared-density-role", declaredDensityRole, {
  valid: [
    { code: '<button data-slot="button" />', options },
    { code: 'const props = { "data-slot": "card-header" };', options },
    { code: 'useRender({ state: { slot: "sidebar-group" } });', options },
    // React Aria's JSX `slot` names a context slot, not a part.
    { code: '<Heading slot="title" />', options },
    // A slot chosen at runtime is the caller's to declare.
    { code: "<div data-slot={name} />", options },
    { code: '<div data-slot="probe" />', options, filename: "probe.test.tsx" },
  ],
  invalid: [
    { code: '<div data-slot="card-footer" />', options, errors: [{ messageId: "undeclared" }] },
    { code: '<div dataSlot={"chip"} />', options, errors: [{ messageId: "undeclared" }] },
    { code: 'useRender({ state: { slot: "badge" } });', options, errors: [{ messageId: "undeclared" }] },
    {
      code: '<div data-slot="button" />',
      options: [{ roles: join(directory, "missing.ts") }],
      errors: [{ messageId: "table" }],
    },
  ],
});
