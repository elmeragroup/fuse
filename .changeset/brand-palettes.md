---
"@elmeragroup/fuse": minor
---

Every theme now declares two brand palettes, `--brand-1-50` to `--brand-1-950` and `--brand-2-50` to
`--brand-2-950`, with 50 the lightest. They share the brand neutral ramp's lightness at each step, so a
step means the same lightness in every palette. Each palette passes through its seed colour, a curated
brand tone, at the step nearest the seed's lightness, so that step holds the seed exactly. The other steps
sit on the shared lightness table at the seed's hue and chroma, with chroma lowered only where sRGB
cannot hold it at that lightness.

- Palette 1 is the brand colour, seeded by the brand's `--feature`. Fjordkraft's company segment and
  Fjordkraft Företag use its teal.
- Palette 2 is a second brand colour: Telinet's green `#36C275` and Gudbrandsdal Energi's orange
  `#FF9100`. Every other brand has one colour, so each `--brand-2-N` is `var(--brand-1-N)`.

The palettes have one value per brand and segment in light and dark and in both identities. `:root`
declares untinted greys. The Tailwind utilities `bg-brand-1-800`, `text-brand-2-400` and the rest read
them. The theme catalog, the Figma sync and the DTCG export carry the 22 new tokens.

Telinet's branded light `--feature-foreground` is now `var(--brand-2-400)`, the step that holds its
green, so it still paints `#36C275`. No other role changes value.
