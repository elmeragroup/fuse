---
"@elmeragroup/fuse": minor
---

`Dialog.Content`, `AlertDialog.Content` and `Sheet.Content` fill with a new theme role pair,
`--dialog` and `--dialog-foreground`. Internal themes and every dark theme alias `--popover` and
`--popover-foreground`, so they look as before. External light themes fill a modal with the page
tint, `--background`, and set its text in the page's `--foreground`, so the white fields and
selection rows inside it stand apart as they do on the page. Before, an external light modal was
white, the same colour as those fields and rows, and its text took the neutral popover ink.
Popover, Select, Combobox, DropdownMenu, NavigationMenu, Toolbar, Toast, `Command.Content` and the
mobile `Sidebar` keep their fills. The theme rules resolve the role on the element that carries the
theme attributes, so a `--popover` override on a plain wrapper no longer reaches a modal; set
`--dialog` there instead. To keep one modal on the popover fill, pass
`className="bg-popover text-popover-foreground"`. A host that maps its own tokens onto Fuse roles
can set the pair directly; without it a modal falls back to `--popover` and `--popover-foreground`.
