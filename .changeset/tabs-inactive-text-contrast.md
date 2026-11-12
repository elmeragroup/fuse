---
"@elmeragroup/fuse": patch
---

An inactive `Tabs.Trigger` now draws its label in `muted-foreground` instead of the foreground at
60% opacity, so the label holds the WCAG AA 4.5:1 text contrast on the default list's `muted` track
and on the page, card, card-soft and modal surfaces a `line` list sits on, in every theme and both
color schemes. The light branded themes measured 3.38–4.45:1 before, with Telinet the lowest. Hover
and the active tab still draw the foreground.
