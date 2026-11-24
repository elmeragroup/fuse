---
"@elmeragroup/fuse": patch
---

Date, time and category labels in `Chart.ReferenceArea`, `ClockChart.ReferenceArea` and
`Chart.Table`'s caption, and `DataTableFilter` date chips, join the two ends of a range with the
locale's range separator, as chart tooltips do. It is a spaced en dash in en-US and a bare one in
nb-NO, sv-SE and fi-FI. Chart number bands keep a bare en dash, and `DataTableFilter` number chips
keep Intl's range pattern, with its spaces written as no-break spaces.

A `Chart.ReferenceArea` over the hourly slots that start at 17:00 through 19:00 now prints
`5 PM – 8 PM` in en-US instead of `5 – 6–7 – 8 PM`, and `17–20` in nb-NO instead of `17–18–19–20`.
Readers hear the same two ends, `5 PM to 8 PM`. `ClockChart.ReferenceArea` prints the same sector
as `5:00 PM – 8:00 PM` instead of `5:00 PM–8:00 PM`. A `Chart.ReferenceArea` value band keeps each
number whole and writes the text both ends share after their numbers once, so nb-NO's `1–2 000`
prints as `1 000–2 000`, fi-FI writes `0,12–0,15 €/kWh alv 0 %`, and en-US writes `5–10%`.
`Chart.Table`'s caption shows its period with the same join, such as `Usage, Jan – Apr`, and its
accessible name still reads `Usage, Jan to Apr`. A `DataTableFilter` date chip writes both dates of
a range in full, so en-US prints `Oct 2, 2026 – Oct 12, 2026` instead of `Oct 2 – 12, 2026`.
