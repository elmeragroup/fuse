import { ruleTester } from "../rule-tester.ts";
import { motionSafeTransform } from "./motion-safe-transform.ts";

ruleTester.run("motion-safe-transform", motionSafeTransform, {
  valid: [
    'const root = "motion-safe:data-starting-style:translate-y-1.5 motion-safe:data-ending-style:-translate-y-1.5";',
    'const root = "data-starting-style:motion-safe:scale-95 starting:motion-safe:rotate-3";',
    'const root = "data-ending-style:opacity-0 starting:opacity-0 data-starting-style:h-0";',
    'const centred = "-translate-x-1/2 -translate-y-1/2 data-open:scale-100 hover:rotate-3";',
    'const shell = "data-[starting-style]:opacity-0 data-[ending-style]:motion-safe:translate-y-1";',
    { code: 'const root = "starting:translate-y-1";', filename: "item.test.tsx" },
  ],
  invalid: [
    { code: 'const root = "starting:-translate-y-1.5";', errors: [{ messageId: "unsafe" }] },
    { code: 'const root = "data-starting-style:scale-95";', errors: [{ messageId: "unsafe" }] },
    { code: 'const root = "data-ending-style:rotate-[4deg]";', errors: [{ messageId: "unsafe" }] },
    { code: 'const root = "data-[ending-style]:translate-y-[2px]";', errors: [{ messageId: "unsafe" }] },
    {
      code: 'const root = "data-starting-style:data-[activation-direction=left]:-translate-x-1/2";',
      errors: [{ messageId: "unsafe" }],
    },
    { code: 'const root = "data-ending-style:!scale-y-50";', errors: [{ messageId: "unsafe" }] },
    {
      code: "const root = `data-ending-style:translate-x-1 ${base} data-starting-style:scale-x-90`;",
      errors: 2,
    },
  ],
});
