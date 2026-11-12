---
"@elmeragroup/fuse": patch
---

**Host overrides of light-only theme roles now hold in dark.** The roles a dark palette keeps
from light, `--button-outline-width`, `--button-outline`, `--card-border`,
`--card-section-divider`, `--card-shadow`, the `--selection-*` edge, divider, disabled and
title-weight roles, `--toggle-pressed` and `--toggle-pressed-foreground`, the
`--paragraph-leading-*` roles and the `--heading-*` scale, are no longer restated by the dark rules
in `themes.css`. The light rules declare them in both schemes, so computed values are unchanged. A
host override of one on the theme element, at the light rule's weight, now holds in dark as well as
in light, where a dark rule used to outweigh it, as #466 already did for the corners.
