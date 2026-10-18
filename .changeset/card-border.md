---
"@elmeragroup/fuse": minor
---

`Card` and a `card`-variant `Accordion.Item` draw their 1px edge in a new theme role,
`--card-border`. Internal themes alias it to `--border`, so they look as before. External themes
draw no edge: `--card-border` is a zero-alpha colour, `oklch(0 0 0 / 0)`, in light and dark, so a
white card stands on the page tint by its fill. Before, every
external card was outlined in the grey `--border`. The border keeps its width, so the layout and
inner corners do not move. On a `--card`-coloured surface, such as a nested `Card`, an external card
now has no outline. `CheckboxCard`, the TextField `card` box, the Field label card, `Table`,
`DescriptionList`, `Separator` and the overlay edges keep `--border`. A border colour class on a
`Card` still wins. A box you build from `cardVariants().base()` or the `card` item of
`accordionVariants` takes `--card-border` too, so add `border-border` where it must keep a visible
edge, as `CheckboxCard` and the TextField `card` box do. A plain wrapper that overrides `--border`
no longer recolours cards; override `--card-border` instead. A host that maps its own tokens onto
Fuse roles can set the role directly; without it cards fall back to `--border`.
