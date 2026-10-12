---
"@elmeragroup/fuse": patch
---

`Alert`'s status icon now centres on the title's first line when the alert has a description.
Before, it sat 2px below the line. Beside a description, `Item.Media` and `Item.Content` align to
the row's top. `icon` media centres a glyph of any size on `Item.Title`'s first line, and `default`
and `image` media top-align with the content, so tall media such as an avatar shares the content's
top edge. A glyph that should sit on the title's line belongs in `icon` media. A height or size
class sets the box of `default` and `icon` media, while `image` media keeps the size its row's
size sets. `Item.Actions` stays centred on the row.

`SelectionItem.Actions`, also `CheckboxItem.Actions` and `RadioItem.Actions`, centres text or a
badge on the title's first line, and its text takes the title's line height. Wrapped text keeps
its first line beside the title and grows the row. A plain-text `CheckboxItem` or `RadioItem` row
centres its control on the text's first line at comfortable density.

`Alert.Title`, `Item.Description` and `SelectionItem.Description` reset their block margins, so a
host without Tailwind's preflight keeps the 4px title-to-description gap.
