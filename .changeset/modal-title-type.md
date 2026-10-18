---
"@elmeragroup/fuse": patch
---

`Dialog.Title`, and the `AlertDialog.Content` title through it, grows from 16px on a 16px line to
20px on a 28px line, the type `Sheet.Title` already had. At comfortable density the 16px title was
the size and weight of a `Field.Label`, below the 18px controls in the same dialog, so it no longer
read as the dialog's heading. All three titles now share one class, and a wrapped title keeps the
28px line. `AlertDialog.Content` centres its icon on the title's first line. `Sheet.Title` no longer
paints `--foreground`; it inherits the modal's `--dialog-foreground`, as `Dialog.Title` does, so a
host that sets its own `--dialog-foreground` reaches the Sheet title too. The titles also reset the
`h2` block margins that a host without Tailwind's preflight would otherwise keep. To put one
`Dialog.Title` back on the old type, pass `className="text-base leading-none"`.
