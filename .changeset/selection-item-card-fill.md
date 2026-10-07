---
"@elmeragroup/fuse": patch
---

`SelectionItem.Shell`, and with it every `CheckboxItem` and `RadioItem` row, paints the card fill
(`bg-card`) like `CheckboxCard`, `Input` and the selection controls inside it. Before, it painted the
page background, so wherever `--background` and `--card` differ (every external theme and the dark
themes) a card list showed the page tint inside its border, and a checked row's `bg-muted` read as a
lightening instead of a tint. A list on a surface that should show through takes a background class,
for example `className="bg-background"`, which merges after the fill.
