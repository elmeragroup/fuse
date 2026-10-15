---
"@elmeragroup/fuse": patch
---

An explicit `role` on `Alert.Root` now replaces its default `alert` role. Before, `Alert.Root`
always rendered `role="alert"` and ignored the passed role. Pass `role="status"` for an
informational alert that screen readers should announce politely instead of interrupting, on a
status region that stays mounted while its message changes, or `role="none"` for a static
notice. Without a `role`, `Alert.Root` still renders `role="alert"`.
