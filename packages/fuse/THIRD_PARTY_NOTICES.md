# Third-party notices

This package's own code is MIT. The following vendored artwork retains its source
license and is **not** relicensed as MIT with the surrounding component code.

## Twemoji — Copyright 2019 Twitter, Inc and other contributors

The five hand-inlined face graphics in `@elmeragroup/fuse/emoji` are Twemoji artwork
for the following code points:

- U+1F641 Slightly Frowning Face
- U+1F642 Slightly Smiling Face
- U+1F610 Neutral Face
- U+1F62D Loudly Crying Face
- U+1F973 Partying Face

Maintained source: https://github.com/jdecked/twemoji

Licensed under Creative Commons Attribution 4.0 International
(https://creativecommons.org/licenses/by/4.0/). The complete `LICENSE-GRAPHICS`
text ships at `licenses/twemoji-CC-BY-4.0.txt`.

### Modifications

The graphics are inlined as React components. An accessibility/data-slot wrapper
was added (`aria-hidden` / `focusable` decorative default, optional `label` →
`role="img"` + `aria-label`, and `data-slot="emoji"`). SVG path data unchanged.

## evilcharts, Copyright 2026 Gurbinder

The SVG pattern paths that `Chart.Background` draws in `@elmeragroup/fuse/chart` are ported
from evilcharts at commit `ecbd6a5db7b25f9a7e070c02b2ef728c378eeb5c`.

Maintained source: https://github.com/legions-developer/evilcharts

Licensed under the MIT License. The complete licence text ships unchanged at
`LICENSE-evilcharts` in the package root.

### Modifications

Each pattern draws inside a Fuse SVG `pattern` element with sanitised ids, an alpha mask and
a softening filter, and paints through the chart's colour roles.
