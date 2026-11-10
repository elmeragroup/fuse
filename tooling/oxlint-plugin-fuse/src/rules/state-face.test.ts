import { ruleTester } from "../rule-tester.ts";
import { stateFace } from "./state-face.ts";

ruleTester.run("state-face", stateFace, {
  valid: [
    'const row = "group-data-disabled/field:opacity-50 peer-data-disabled:opacity-50";',
    'const fill = "disabled:bg-muted opacity-50 data-[hovering]:pointer-events-auto";',
    'const face = "enabled-hover:bg-muted enabled-active:scale-[0.96] group-hover:bg-muted";',
    "const recipe = { variants: { isDisabled: { true: racDisabledStateFaceClass } } };",
    'const recipe = { variants: { muted: { true: "opacity-50" }, isDisabled: { true: "cursor-not-allowed" } } };',
    'const classes = cn(base, isVisuallyDisabled && "cursor-not-allowed");',
    'const classes = cn(isOpen && "opacity-0");',
    { code: 'const dim = "disabled:opacity-50";', filename: "button.test.tsx" },
  ],
  invalid: [
    { code: 'const dim = "disabled:opacity-50";', errors: [{ messageId: "dim" }] },
    { code: 'const dim = "aria-disabled:pointer-events-none";', errors: [{ messageId: "dim" }] },
    {
      code: 'const dim = "has-[[data-slot=input-group-control]:disabled]:opacity-50";',
      errors: [{ messageId: "dim" }],
    },
    { code: 'const dim = "data-open:disabled:opacity-70";', errors: [{ messageId: "dim" }] },
    {
      code: 'const recipe = { variants: { isDisabled: { true: "opacity-75" } } };',
      errors: [{ messageId: "dim" }],
    },
    {
      code: 'const recipe = { variants: { disabled: { true: { root: "cursor-not-allowed pointer-events-none" } } } };',
      errors: [{ messageId: "dim" }],
    },
    { code: 'const classes = cn(base, isVisuallyDisabled && "opacity-70");', errors: [{ messageId: "dim" }] },
    {
      code: 'const classes = isDisabled ? "pointer-events-none" : "cursor-pointer";',
      errors: [{ messageId: "dim" }],
    },
    { code: 'const face = "hover:bg-muted";', errors: [{ messageId: "pointer" }] },
    { code: 'const face = "active:scale-[0.96] data-open:hover:bg-muted";', errors: 2 },
    { code: 'const face = "*:[a]:hover:x";', errors: [{ messageId: "pointer" }] },
  ],
});
