---
"@elmeragroup/fuse": patch
---

Light `--muted-foreground` is now an opaque colour that reaches 4.5:1 on `--background`, `--muted`,
`--card` and `--card-soft` in every theme, so field and selection row descriptions, popover copy and
other muted text meet WCAG 2.2 AA 1.4.3. The external palettes and the fkas company segment drew the
brand foreground at 70% alpha, so the same text measured differently on each surface; each now sets
an opaque tone of that foreground that matches the old colour on a white card. Telinet (`fkse`)
darkens slightly, from 4.35:1 to 4.56:1 on `--muted`, and the internal light grey moves from
`oklch(0.5555 0 0)` to `oklch(0.544 0 0)`, from 4.35:1 to 4.56:1 on `--muted` and `--card-soft`.
Nordic Green Energy and every dark theme keep their values. The accessibility page no longer lists
muted text as an accepted deviation. Muted text over a host's own tinted fill or image no longer
lets that backdrop show through.
