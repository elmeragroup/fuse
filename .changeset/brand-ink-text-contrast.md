---
"@elmeragroup/fuse": minor
---

Add the `--brand-ink` token and its `text-brand-ink` utility: the brand color as text, at 4.5:1
contrast or more on the page and on a card in every theme and color scheme. A brand color that
already reaches 4.5:1 on both keeps the `var(--brand)` alias. For another brand, Fuse adjusts the
lightness in 0.01 steps and keeps the hue until the color passes on both backgrounds, as
`--sidebar-brand` does on the sidebar. A host that skips `themes.css` and declares only `--brand`
gets brand text in `--brand`. A Tailwind-source host that maps `--color-brand` in its own
`@theme` gets it in that color, and one that clears `--color-brand` gets it in `--brand`.

The Palettes handbook now lists `--brand-ink` on the page and on a card, and the two sidebar brand
pairs, among the pairs held at 4.5:1 in every theme and color scheme.

`variant="brand"` on `Heading`, `Text`, `Link` and `Span` now sets `text-brand-ink` in place of
`text-brand`, so brand text passes 4.5:1. Its color changes in Fjordkraft, Fjordkraft Företag and
TrøndelagKraft light themes, which get a darker tone, and in Gudbrandsdal Energi, Telinet, Elmera
and Nordic Green Energy dark themes, which get a lighter one. `--brand` keeps the brand color for
fills. A brand `Link` with `underline="none"` now underlines under the pointer instead of fading,
so the fade cannot take its text under 4.5:1 on the page or a card.

**Breaking:** in the themes listed above, and under a `--brand` override on a plain wrapper inside
a theme element in any theme, `--brand` no longer recolors `variant="brand"` text. Set
`--brand-ink` as well. The build computes the stepped tones, so the stylesheet declares them as
literal colors. To restyle brand text in a theme, override `--brand-ink` on the element that
carries the theme attributes, in a rule after the Fuse stylesheet, with a second rule for the dark
scheme, as the theming handbook shows for `--sidebar-brand`. A Tailwind-source host that resets
the color namespace (`--color-*: initial`) and maps its own colors maps `--color-brand-ink` too.
