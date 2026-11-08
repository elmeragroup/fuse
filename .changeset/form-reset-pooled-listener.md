---
"@elmeragroup/fuse": patch
---

Uncontrolled checked controls and text fields now share one `reset` listener per document or shadow
root to follow a native form reset. Before, each `Checkbox`, `Switch`, `CheckboxCard`, radio and
field added a listener of its own, so a `DataTable` with a selection checkbox per row added one per
row.
