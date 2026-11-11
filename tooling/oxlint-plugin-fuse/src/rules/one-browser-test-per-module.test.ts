import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

import { ruleTester } from "../rule-tester.ts";
import { oneBrowserTestPerModule } from "./one-browser-test-per-module.ts";

// A component folder on disk: the rule reads the linted file's siblings.
const folder = mkdtempSync(join(tmpdir(), "one-browser-test-"));
for (const name of [
  "button.tsx",
  "button-focus.browser.test.tsx",
  "button-keyboard.browser.test.tsx",
  "menu.tsx",
  "menu-keyboard.browser.test.tsx",
  "select.tsx",
  "select.browser.test.tsx",
  "select-variants.ts",
  "select-format.engines.browser.test.ts",
  "select-keyboard.test.ts",
  "fuse.css",
]) {
  writeFileSync(join(folder, name), "");
}
afterAll(() => rmSync(folder, { recursive: true, force: true }));

const code = 'it("opens", () => {});';

ruleTester.run("one-browser-test-per-module", oneBrowserTestPerModule, {
  valid: [
    { code, filename: join(folder, "select.browser.test.tsx") },
    // Named after a module beside it, so it is that module's own file.
    { code, filename: join(folder, "select-variants.browser.test.ts") },
    { code, filename: join(folder, "fuse.browser.test.tsx") },
    // No module's name is its prefix, so it has no owner.
    { code, filename: join(folder, "listbox-keyboard.browser.test.tsx") },
    // The only browser file for its owner, even without the canonical name.
    { code, filename: join(folder, "menu-keyboard.browser.test.tsx") },
    // The engine and clipboard lanes are counted on their own: one file each.
    { code, filename: join(folder, "select-format.engines.browser.test.ts") },
    { code, filename: join(folder, "select-paste.clipboard.browser.test.tsx") },
    { code, filename: join(folder, "select-keyboard.test.ts") },
  ],
  invalid: [
    // Two split files for one module, with no canonical file, are both reported.
    {
      code,
      filename: join(folder, "button-focus.browser.test.tsx"),
      errors: [
        { messageId: "second", data: { file: "button-focus.browser.test.tsx", owner: "button", count: "2" } },
      ],
    },
    {
      code,
      filename: join(folder, "button-keyboard.browser.test.tsx"),
      errors: [
        {
          messageId: "second",
          data: { file: "button-keyboard.browser.test.tsx", owner: "button", count: "2" },
        },
      ],
    },
    {
      code,
      filename: join(folder, "select-keyboard.browser.test.tsx"),
      errors: [
        {
          messageId: "second",
          data: { file: "select-keyboard.browser.test.tsx", owner: "select", count: "2" },
        },
      ],
    },
    // A lane file is not the module's browser-lane file, so the split counts against `select`.
    {
      code,
      filename: join(folder, "select-format-reset.browser.test.ts"),
      errors: [
        {
          messageId: "second",
          data: { file: "select-format-reset.browser.test.ts", owner: "select", count: "2" },
        },
      ],
    },
    // Two files of one lane for one owner.
    {
      code,
      filename: join(folder, "select-dates.engines.browser.test.ts"),
      errors: [
        {
          messageId: "second",
          data: { file: "select-dates.engines.browser.test.ts", owner: "select", count: "2" },
        },
      ],
    },
  ],
});
