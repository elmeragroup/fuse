---
"@elmeragroup/fuse": patch
---

An unchecked `Switch` fills its track with `--muted-foreground` instead of `--input`, so the track
measures 3:1 or more against the page, a card and card-soft in every theme and color scheme, and
the `--background` thumb stands out on it (WCAG 2.2 SC 1.4.11). Light `--input` measured
1.08–1.70:1, so an unchecked switch showed as a faint pill with a thumb in nearly the same color.
This is the role the unchecked `Checkbox` and `Radio` edge already uses. Dark switches change the
same way. The checked track stays `--primary`, and a disabled switch keeps the shared 50% dim over
the new track.
