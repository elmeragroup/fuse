---
"@elmeragroup/fuse": minor
---

`DescriptionList.Content` takes `layout="inline"` for label/value rows in receipts, order summaries
and price boxes. Each term and its details stay on one row at every width, and the details align to
the end of the row. A short details never wraps, and a long one wraps within 60% of the row. Inline
rows take the label type and follow density, are spaced by the small surface gap and draw no rules.
The term is not muted, and a colour class on a term still applies. Consecutive inline lists are
spaced by the large surface gap, so each list is one group. The default `layout="responsive"` is
unchanged, and the list writes its layout as `data-layout`.
