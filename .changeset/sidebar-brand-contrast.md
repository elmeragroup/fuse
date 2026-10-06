---
"@elmeragroup/fuse": patch
---

`--sidebar-brand` and `--sidebar-brand-foreground` now reach 4.5:1 contrast in every theme and
color scheme. Where the brand color falls short on the sidebar, the theme steps its lightness
away from the sidebar's until it passes, keeping the hue. In light themes, Fjordkraft,
Fjordkraft Företag and TrøndelagKraft get a darker sidebar tone. In dark themes, Gudbrandsdal
Energi, Telinet and Elmera get a lighter one. In dark themes, text on a `bg-sidebar-brand` fill
now takes the sidebar color for every brand, because white cannot reach 4.5:1 on a tone that
reaches it on a dark sidebar. `--brand` keeps the brand color everywhere else.

The build computes the stepped tones, so the stylesheet declares them as literal colors. In the
themes listed above, a host override of `--brand` no longer moves `--sidebar-brand`, and in
every dark theme `--sidebar-brand-foreground` no longer follows `--brand-foreground`. To keep a
custom sidebar brand, override both sidebar tokens on the element that carries the theme
attributes, in a rule after the Fuse stylesheet. The rule applies in both color schemes, so give
the dark scheme its own pair. The dark rule lists two selectors: one for a theme element inside
a dark ancestor, and one for an element that carries `data-theme="dark"` itself, such as a
themed `<html>`:

```css
.app-shell[data-theme-brand="tkas"] {
  --sidebar-brand: oklch(0.45 0.08 191);
  --sidebar-brand-foreground: oklch(1 0 0);
}

[data-theme="dark"] .app-shell[data-theme-brand="tkas"],
.app-shell[data-theme="dark"][data-theme-brand="tkas"] {
  --sidebar-brand: oklch(0.75 0.08 191);
  --sidebar-brand-foreground: oklch(0.205 0 0);
}
```
