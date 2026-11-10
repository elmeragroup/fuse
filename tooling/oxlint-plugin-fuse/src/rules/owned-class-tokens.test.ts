import { ruleTester } from "../rule-tester.ts";
import { ownedClassTokens } from "./owned-class-tokens.ts";

const options = [{ owner: "overlay-classes.ts", spellings: ["z-50", "bg-popover text-popover-foreground"] }];

ruleTester.run("owned-class-tokens", ownedClassTokens, {
  valid: [
    { code: 'const layer = "z-500 relative";', options },
    { code: 'const surface = "bg-popover";', options },
    { code: "// z-50 is the overlay layer.\nconst x = 1;", options },
    { code: 'const popup = cn("z-50", className);', options, filename: "popup.test.tsx" },
  ],
  invalid: [
    { code: 'const popup = cn("z-50", className);', options, errors: [{ messageId: "copy" }] },
    {
      code: 'const popup = <div className="rounded-md bg-popover text-popover-foreground shadow-md" />;',
      options,
      errors: [{ messageId: "copy" }],
    },
    { code: "const layer = `fixed z-50 ${inset}`;", options, errors: [{ messageId: "copy" }] },
  ],
});
