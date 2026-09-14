---
"@elmeragroup/ui": patch
---

External `elma` themes now carry the Elmera palette from the brand's Figma
role sheet instead of a grayscale copy of the defaults: teal-tinted
`background`, `foreground`, `primary`, `secondary`, the soft pairs and the
`feature` triple all change. `--brand-elma` moves to the same P-20 tone as
the elma foreground.

`--primary-soft` for fkas and tkas is now P-95, byte-identical to their
`--secondary-soft`, so every brand backed by a role sheet follows one rule.
Surfaces using `bg-primary-soft` in those brands render a slightly more
saturated tint.

External `--muted-foreground` is documented as an accepted contrast
deviation (≈ 2.7–2.9:1, non-essential text only) in the accessibility
spec; no values changed for that token.
