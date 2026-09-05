# Third-party notices

This package's own code is MIT. The following vendored artwork retains its source
license and is **not** relicensed as MIT with the surrounding component code.

## Twemoji — Copyright 2019 Twitter, Inc and other contributors

The five hand-inlined face graphics in `@elmeragroup/ui/emoji` are Twemoji artwork
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
