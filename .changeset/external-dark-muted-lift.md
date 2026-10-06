---
"@elmeragroup/fuse": patch
---

External dark themes give `--muted` its own tone, 8% of the way from `--card` toward `--foreground`,
the same step `--accent` takes from `--popover`. Before, `--muted` repeated `--card` and `--popover`, so
`hover:bg-muted` painted nothing visible over them: a ghost Button in a Dialog or Popover, a Calendar day
in the DatePicker, or a linked `Item`. A brand sheet that sets `muted` keeps its own value.
