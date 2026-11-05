---
"@elmeragroup/fuse": minor
---

Every theme now has two eleven-step brand ramps as tokens. `--brand-neutral-50` to
`--brand-neutral-950` is a grey tinted with the brand hue, and `--brand-shade-50` to
`--brand-shade-950` runs the brand hue from light to dark. Tailwind utilities such as
`bg-brand-shade-500` and `text-brand-neutral-900` read them. A ramp changes with the brand and
segment, and stays the same in light and dark and in both variants.

Fjordkraft, TrøndelagKraft, Gudbrandsdal Energi and Telinet use the ramps from the Figma brand
collection. Fjordkraft company and Fjordkraft Företag share the Bedrift ramps. Elmera and Nordic
Green Energy have no ramps in Figma, so theirs are generated from the brand color. The generated
shade ramp passes through the brand color at shade 900 for Elmera and shade 800 for Nordic Green
Energy.

Use a role where one exists, and a ramp step when a product needs a tone no role has.
