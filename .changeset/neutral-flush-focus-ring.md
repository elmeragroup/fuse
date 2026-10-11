---
"@elmeragroup/fuse": patch
---

The focus ring is one neutral grey, `oklch(0.6 0 0)`, in every theme and both colour schemes, held to 3:1 against the page and card surfaces. It is a flush 2px ring with no offset gap. A keyboard-focused invalid control paints the ring in solid `--error` instead of the resting error halo, so focus stays visible on an invalid field. The `Button` fill now reaches its border edge, so no hairline of page shows between the fill and the ring. Every external theme rule declares `--ring` and `--sidebar-ring`, so a brand can tune its ring with a `ring` entry in its light palette and in each of its dark sheets, segment sheets included, and a host's `--ring` on one scope stops at a nested theme scope.
