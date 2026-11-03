---
"@elmeragroup/fuse": minor
---

Every theme now has two brand ramps of eleven steps as tokens: `--brand-neutral-50` to
`--brand-neutral-950`, a grey tinted with the brand hue, and `--brand-shade-50` to
`--brand-shade-950`, the brand hue from light to dark. Tailwind utilities such as
`bg-brand-shade-500` and `text-brand-neutral-900` read them. A ramp follows the brand and segment and
holds the same values in light and dark and in both variants. Fjordkraft, Fjordkraft company and
Fjordkraft Företag, TrøndelagKraft, Gudbrandsdal Energi and Telinet take the ramps of the Figma brand
collection; Fjordkraft company and Fjordkraft Företag share the Bedrift ramps. Elmera and Nordic Green
Energy have no ramps in Figma, so theirs are generated from the brand color, and the generated shade
ramp passes through the brand color at shade 900 for Elmera and shade 800 for Nordic Green Energy. Use
a role where one exists, and a ramp step when a product needs a tone no role holds.
