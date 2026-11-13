import { ruleTester } from "../rule-tester.ts";
import { containerSurface } from "./container-surface.ts";

ruleTester.run("container-surface", containerSurface, {
  valid: [
    // Card's recipe.
    'const root = "flex flex-col border-card-border bg-card text-card-foreground [--surface:--theme(--color-card)]";',
    'const fill = "bg-popover text-popover-foreground [--surface:--theme(--color-popover)]";',
    "const panel = `relative bg-panel ${shadow} [--surface:--theme(--color-panel)]`;",
    // The compact VerticalTable passes its host's surface through.
    'const box = "bg-panel [--surface:--theme(--color-panel)] in-data-[variant=compact]:bg-inherit in-data-[variant=compact]:[--surface:inherit]";',
    'const box = "lg:bg-card lg:[--surface:inherit]";',
    // The framed Table's cells pair the fill and the surface under one prefix.
    'const cells = "framed-table:*:[tr]:*:[td]:bg-panel framed-table:*:[tr]:*:[td]:[--surface:--theme(--color-panel)]";',
    // State fills, a pseudo-element and a translucent fill are not resting fills.
    'const tab = "data-active:bg-card group-data-[variant=default]/tabs-list:data-active:text-card-foreground";',
    'const face = "enabled-hover:bg-card hover:bg-panel focus-visible:bg-popover aria-selected:bg-dialog group-hover/row:bg-card";',
    'const row = "has-[>label_[data-checked]]:bg-card [&:hover]:bg-panel";',
    // Each state pseudo-class is exempt in its named and its arbitrary spelling alike.
    'const form = "required:bg-card [&:required]:bg-card valid:bg-panel [&:valid]:bg-panel read-write:bg-popover [&:read-write]:bg-popover";',
    'const native = "open:bg-card [&[open]]:bg-card disabled:bg-panel [&[disabled]]:bg-panel inert:bg-popover [&[inert]]:bg-popover";',
    'const field = "read-only:bg-card [&[readonly]]:bg-card";',
    // Base UI's, ARIA's and Fuse's own state attributes, named and in a selector.
    'const flags = "data-[state=open]:bg-card data-armed:bg-panel aria-busy:bg-popover [&[data-in-range]]:bg-dialog data-hidden:bg-card";',
    // A structural attribute fill passes once it states its surface under the same prefix.
    'const side = "data-[side=left]:bg-panel data-[side=left]:[--surface:--theme(--color-panel)]";',
    'const arrow = "before:border before:bg-popover";',
    'const arrow = "[&::before]:bg-popover file:bg-card [&::file-selector-button]:bg-card";',
    'const glass = "backdrop-blur-md bg-popover/70";',
    'const other = "bg-card-soft bg-muted text-card-foreground";',
    { code: 'const fill = "bg-card";', filename: "card.test.tsx" },
  ],
  invalid: [
    // Card's recipe without its surface.
    {
      code: 'const root = "flex flex-col border-card-border bg-card text-card-foreground";',
      errors: [{ messageId: "missing" }],
    },
    // A card fill stating the panel surface.
    {
      code: 'const root = "bg-card [--surface:--theme(--color-panel)]";',
      errors: [{ messageId: "mismatch" }],
    },
    {
      code: 'const fill = "bg-dialog text-dialog-foreground [--surface:--theme(--color-popover)]";',
      errors: [{ messageId: "mismatch" }],
    },
    { code: 'const fill = "!bg-popover";', errors: [{ messageId: "missing" }] },
    // A prefixed fill needs a surface under the same prefix.
    {
      code: 'const cells = "framed-table:*:[tr]:*:[td]:bg-panel [--surface:--theme(--color-panel)]";',
      errors: [{ messageId: "missing" }],
    },
    {
      code: 'const cells = "framed-table:*:[tr]:*:[td]:bg-panel framed-table:*:[tr]:[--surface:--theme(--color-panel)]";',
      errors: [{ messageId: "missing" }],
    },
    {
      code: 'const box = "bg-panel md:bg-card [--surface:--theme(--color-panel)]";',
      errors: [{ messageId: "missing" }],
    },
    // A structural `not-` variant is not a state.
    { code: 'const box = "not-framed-table:bg-card";', errors: [{ messageId: "missing" }] },
    // A structural attribute is not a state, in a selector, a relative prefix or a named variant.
    {
      code: 'const box = "[&_[data-slot=card]]:bg-card [&_[data-slot=card]]:[--surface:--theme(--color-panel)]";',
      errors: [{ messageId: "mismatch" }],
    },
    {
      code: 'const box = "has-[>[data-slot=card-content]]:bg-card has-[>[data-slot=card-content]]:[--surface:--theme(--color-panel)]";',
      errors: [{ messageId: "mismatch" }],
    },
    { code: 'const box = "data-[variant=card]:bg-card";', errors: [{ messageId: "missing" }] },
    // Frame's `data-[layout=flush]` names a layout, not a state.
    {
      code: 'const panel = "data-[layout=flush]:bg-panel data-[layout=flush]:[--surface:--theme(--color-card)]";',
      errors: [{ messageId: "mismatch" }],
    },
    // `aria-hidden` marks structure, though Base UI's `data-hidden` is a state, in a selector and
    // as a named variant.
    {
      code: 'const group = "has-[select[aria-hidden=true]:last-child]:bg-panel";',
      errors: [{ messageId: "missing" }],
    },
    { code: 'const group = "aria-hidden:bg-panel";', errors: [{ messageId: "missing" }] },
    // Every attribute off the state list names structure, not only the familiar ones.
    { code: 'const panel = "data-[side=left]:bg-panel";', errors: [{ messageId: "missing" }] },
    { code: 'const panel = "data-inset:bg-panel";', errors: [{ messageId: "missing" }] },
    { code: 'const box = "has-[>[data-align=block-end]]:bg-card";', errors: [{ messageId: "missing" }] },
    { code: 'const box = "[&:has(+[data-selection-item])]:bg-card";', errors: [{ messageId: "missing" }] },
    {
      code: 'const panel = "data-[sole-table=true]:bg-panel data-[sole-table=true]:[--surface:--theme(--color-card)]";',
      errors: [{ messageId: "mismatch" }],
    },
    {
      code: 'const panel = "has-[>[data-focus-ring-control]]:bg-panel";',
      errors: [{ messageId: "missing" }],
    },
    {
      code: 'const box = "group-data-[size=sm]/card:bg-panel group-data-[size=sm]/card:[--surface:--theme(--color-card)]";',
      errors: [{ messageId: "mismatch" }],
    },
    { code: "const panel = `bg-panel ${shadow}`;", errors: [{ messageId: "missing" }] },
    {
      code: 'const recipe = tv({ variants: { variant: { card: "bg-card", panel: "bg-panel" } } });',
      errors: 2,
    },
  ],
});
