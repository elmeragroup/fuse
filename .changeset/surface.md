---
"@elmeragroup/fuse": minor
---

A chart's cut-outs now paint the fill of the host it rests on instead of the page colour. The new
`--surface` custom property is the colour of the opaque fill an element sits on. Card,
`Frame.Panel`, the cells of a Table in a Frame, the default Alert, the bordered `VerticalTable` box, the outline Item, the muted CheckboxCard, the read-only card TextField, the card Accordion, Calendar,
Dialog, AlertDialog, Sheet, Popover and the other anchored popups state their fill as `--surface`. Dot rings and halos, ring-dot
holes, pie and ghost seams, isometric bar faces, reference-label halos, hollow legend swatches and
the polar radius, Now and value chips read `var(--surface, var(--background))`, so a chart in a
Card in a dark theme, or in a branded light theme, no longer shows rings in the page colour. Charts
on the page look as before. Beside `--surface`, each host states `--surface-muted-foreground`, the
muted text paired with its fill: the warning and info Alerts their soft foreground, every other host
`--muted-foreground`. The polar radius values, the Now label and the reference lines and labels in
the default and muted tones read it, so they keep 4.5:1 on the chip or halo they sit on, also in a
warning or info Alert. A muted Now label keeps the full muted text, as a muted reference label
does, and only the hand fades. The frosted chart tooltip's translucent fill keeps the surface beneath it. To put a chart on another opaque fill, set both beside it, as in
`className="bg-muted [--surface:var(--muted)] [--surface-muted-foreground:var(--muted-foreground)]"`;
`ChartStyle` types them for a `style`.

The new `panel` role pair, `--panel` and `--panel-foreground` with the `bg-panel` and
`text-panel-foreground` utilities, is `card` in light themes and `background` in dark ones.
`Frame.Panel`, the cells of a Table in a Frame, the bordered `VerticalTable` box, the default
Alert and the outline Item fill with it, so in light themes they are white like a Card, also where a branded page is
tinted. Dark themes look as before.

Text travels with each of these fills: a hovered or selected Table row and a hovered outline link
Item set their text in `foreground` on the `muted` hover fill, a checked selection row in
`foreground`, and a disabled one, its SubSection included, in `--selection-disabled-foreground`.
A checked selection row states its `muted` fill as `--surface`, a disabled one its disabled fill,
and a hovered outline link Item its `muted` hover.
A text colour class on the part, such as `className="text-error"`, wins in every state.
