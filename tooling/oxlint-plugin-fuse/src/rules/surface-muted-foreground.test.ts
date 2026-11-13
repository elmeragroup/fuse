import { ruleTester } from "../rule-tester.ts";
import { surfaceMutedForeground } from "./surface-muted-foreground.ts";

ruleTester.run("surface-muted-foreground", surfaceMutedForeground, {
  valid: [
    // An important marker, after the utility or before it, still states the property.
    'const card = "[--surface:--theme(--color-card)] [--surface-muted-foreground:--theme(--color-muted-foreground)]!";',
    'const card = "[--surface:--theme(--color-card)]! ![--surface-muted-foreground:--theme(--color-muted-foreground)]";',
    'const row = "hover:[--surface:--theme(--color-muted)]! hover:[--surface-muted-foreground:--theme(--color-muted-foreground)]";',
    'const card = "bg-card [--surface:--theme(--color-card)] [--surface-muted-foreground:--theme(--color-muted-foreground)]";',
    'const row = "has-[[data-checked]]:bg-muted has-[[data-checked]]:[--surface:--theme(--color-muted)] has-[[data-checked]]:[--surface-muted-foreground:--theme(--color-muted-foreground)]";',
    'const tint = "bg-error/5 [--surface:inherit] [--surface-muted-foreground:inherit]";',
    "const cell = `framed-table:*:[td]:[--surface:--theme(--color-panel)] framed-table:*:[td]:[--surface-muted-foreground:--theme(--color-muted-foreground)]`;",
    'const gap = "gap-(--surface-gap-md) p-(--surface-pad-lg)";',
    {
      code: 'const expected = ["[--surface:--theme(--color-popover)]"];',
      filename: "overlay-classes.test.ts",
    },
  ],
  invalid: [
    // An important `--surface` still states a surface, and the report names the class as written.
    {
      code: 'const card = "bg-card [--surface:--theme(--color-card)]!";',
      errors: [{ messageId: "missing", data: { token: "[--surface:--theme(--color-card)]!", variants: "" } }],
    },
    {
      code: 'const row = "hover:[--surface:--theme(--color-muted)]!";',
      errors: [
        {
          messageId: "missing",
          data: { token: "hover:[--surface:--theme(--color-muted)]!", variants: "hover:" },
        },
      ],
    },
    {
      code: 'const legacy = "![--surface:--theme(--color-panel)]";',
      errors: [
        { messageId: "missing", data: { token: "![--surface:--theme(--color-panel)]", variants: "" } },
      ],
    },
    { code: 'const card = "bg-card [--surface:--theme(--color-card)]";', errors: [{ messageId: "missing" }] },
    {
      code: 'const row = "has-[[data-checked]]:[--surface:--theme(--color-muted)] [--surface-muted-foreground:--theme(--color-muted-foreground)]";',
      errors: [{ messageId: "missing" }],
    },
    {
      code: 'const box = "[--surface:--theme(--color-panel)] in-data-[variant=compact]:[--surface-muted-foreground:inherit]";',
      errors: [{ messageId: "missing" }],
    },
    {
      code: "const cell = `[--surface:--theme(--color-panel)] [--surface-muted-foreground:--theme(--color-muted-foreground)] hover:[--surface:--theme(--color-muted)]`;",
      errors: [{ messageId: "missing" }],
    },
  ],
});
