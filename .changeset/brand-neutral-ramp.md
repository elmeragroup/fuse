---
"@elmeragroup/fuse": minor
---

Every theme now declares the brand neutral ramp, `--brand-neutral-50` to `--brand-neutral-950`, with
50 the lightest. Each step is a grey at the hue of the brand's `--feature` colour with chroma 0.01, and
Fjordkraft's company segment uses its teal. The ramp has one value per brand and segment in light and
dark and in both identities, and every brand's ramp uses the same lightness at each step. `:root`
declares an untinted grey ramp. The Tailwind utilities `bg-brand-neutral-100`, `border-brand-neutral-300`
and the rest read it. The theme catalog, the Figma sync and the DTCG export carry the 11 new tokens.

Branded light themes now tint their neutral roles with the brand hue instead of using untinted or
unrelated greys. `--sidebar` and `--right-panel` point at step 50, `--muted` and `--accent` at 100,
`--input`, `--sidebar-accent` and `--sidebar-border` at 200, and `--border` at 300. Each role is
declared as an alias such as `var(--brand-neutral-100)`, so overriding a step on the theme element
moves every role that reads it. The lightness stays close to the old values except in these cases:

- `--border` is 0.88, so it keeps 1.19:1 on the darkest brand page tint.
- `--muted` and `--accent` are 0.965.
- Nordic Green Energy's border and input are lighter than its former Material outline-variant.

Telinet's `--muted-foreground` darkens slightly, so it still reaches 4.5:1 on the tinted `--muted`.
Neutral themes and branded dark themes are unchanged.
