import { ruleTester } from "../rule-tester.ts";
import { noRingShadowRead } from "./no-ring-shadow-read.ts";

ruleTester.run("no-ring-shadow-read", noRingShadowRead, {
  valid: [
    'import { expectFocusRing } from "../../../test/assert-focus-ring";\nexpectFocusRing(button, "keyboard focus shows the ring");',
    'expect(getComputedStyle(button).getPropertyValue("--ring")).not.toBe("");',
    '// --tw-ring-shadow is Tailwind\'s; the helper reads the painted ring\nexpectFocusRing(button, "ring");',
  ],
  invalid: [
    {
      code: 'expect(getComputedStyle(button).getPropertyValue("--tw-ring-shadow")).not.toBe("");',
      errors: [{ messageId: "ringShadow" }],
    },
    {
      code: "const shadow = getComputedStyle(button).getPropertyValue(`--tw-ring-shadow`);",
      errors: [{ messageId: "ringShadow" }],
    },
    {
      code: 'expect(button.style.cssText).toContain("--tw-ring-shadow: 0 0 0 2px");',
      errors: [{ messageId: "ringShadow" }],
    },
  ],
});
