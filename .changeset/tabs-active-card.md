---
"@elmeragroup/fuse": patch
---

The active default `Tabs.Trigger` now fills with `--card` instead of the page fill, so it sits
above its `--muted` list on tinted external light pages. Before, fkas private and guen painted
the active tab darker than its list. In dark the active tab stays darker than its list, one step
closer to it. The `line` variant keeps its transparent face.

Inactive triggers are now transparent in every variant. Before, a consumer of the standalone,
preflight-free stylesheet saw the browser's grey button fill behind them.
