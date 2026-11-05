---
"@elmeragroup/fuse": minor
---

`TrondelagkraftLogo`, and `BrandLogo` with `tkas`, paint the lamp's ring and base in the `--logo-mark-ink` custom property when it is set, in the full logo and the mark. Without it they keep `currentColor`, so nothing changes by default. Set it on the logo or an ancestor to colour the lamp apart from the name, for example `className="[--logo-mark-ink:var(--brand-tkas)]"` for a turquoise lamp beside a text-coloured name, or `white` for the look of the brand's hero.
