---
"@elmeragroup/fuse": patch
---

Each editable segment of `DateField`, `DatePicker` and `DateRangePicker` is now at least 24px wide
and 24px tall at both densities, with its text centered, so it meets the WCAG 2.5.8 target size.
This holds when a `DateInput.Root` children callback wraps each segment in an element of its own.
At dense density and a 16px root, a two-digit segment was 18px wide and a one-digit segment 11px,
so a field can need more horizontal room than before, most of all when it shows values without
leading zeros.
