---
"@elmeragroup/fuse": minor
---

Add `Kbd`, `Command` and the opt-in `@elmeragroup/fuse/command-virtual` entry.

- `Kbd` (`@elmeragroup/fuse/kbd`) renders one key cap as `<kbd>`, and `KbdGroup` the caps of a
  combination in an outer `<kbd>`. Both are server components with one size at both densities. A
  cap renders the glyph it is given and never detects the platform. In an `InputGroup` addon a
  group rounds its caps with the addon's inner corner.
- `Command` (`@elmeragroup/fuse/command`) is a command palette on Base UI's Autocomplete. Its parts
  are `Root` for a flat list of items and `GroupedRoot` for groups of items, each typed as the
  matching Base UI Root overload, then `Input`, `Back`, `List`, `Empty`, `Group`, `GroupLabel`,
  `Collection`, `Item`, `Shortcut`, `Footer`, `Hint`, the key hint presets `NavigateHint`, `SelectHint`, `CloseHint` and
  `BackHint`, and `Dialog`, which places the palette in a `Dialog.Root` near the top of the viewport.
  `Pages`, `Page` and `PageTrigger` stack pages of results; Backspace in an empty field and
  `Command.Back` go back a page. Names, the placeholder, the empty message and the hint labels come
  from the locale dictionary.
- `CommandVirtual` (`@elmeragroup/fuse/command-virtual`) renders long flat lists with TanStack
  Virtual. Install `@tanstack/react-virtual` 3.14 or later beside Fuse; it is an optional peer, and
  the entry is not in the root barrel.
