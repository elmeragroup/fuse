---
"@elmeragroup/fuse": minor
---

Add `Kbd`, `Command` and the opt-in `@elmeragroup/fuse/command-virtual` entry.

- `Kbd`, from `@elmeragroup/fuse/kbd`, renders one key cap as `<kbd>`, and `KbdGroup` renders the
  caps of a combination in an outer `<kbd>`. Both are server components with one size at both
  densities. A cap renders the glyph it is given and never detects the platform. In an
  `InputGroup` addon a group rounds its caps with the addon's inner corner.
- `Command`, from `@elmeragroup/fuse/command`, is a command palette built on Base UI's
  Autocomplete. Every palette starts at `Root`, which holds the dialog's open state, the page stack
  and, in a palette without pages, the search. It types its props as Base UI's flat Autocomplete
  Root overload, or as the grouped one with `grouped`. `Trigger` and `Content` place the palette in
  a dialog near the top of the viewport, and each opening starts with the uncontrolled query and
  stack reset. The other parts are `Input`, `Back`, `List`, `Empty`, `Status`, `Group`,
  `Label`, `Collection`, `Item`, `Shortcut`, `Footer`, `Hint` and the key hint presets
  `NavigateHint`, `SelectHint`, `CloseHint` and `BackHint`. With `defaultPages`, or `pages` and
  `onPagesChange`, the Root holds a stack of pages. Each `Page` holds its own search,
  `PageTrigger` opens one, and Backspace in an empty field and `Back` go back a page. Names, the
  placeholder, the empty message and the hint labels come from the locale dictionary.
- `CommandVirtual`, from `@elmeragroup/fuse/command-virtual`, renders long flat lists with TanStack
  Virtual. Pass `virtualized` to the Root or a `Page`, and `render={<CommandVirtual.List />}` to
  `Command.List`. Install `@tanstack/react-virtual` 3.14 or later beside Fuse. It is an optional
  peer, and the entry is not in the root barrel.
