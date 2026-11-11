---
"@elmeragroup/fuse": patch
---

`Dialog.Content`, `Field.Item` and `Select.Trigger` now drop props passed as `undefined`, because
Base UI merged the `undefined` over the part's own value. Before, an `aria-labelledby={undefined}` on
`Dialog.Content` removed the label that ties the dialog to its title. On `Select.Trigger` it removed
the `aria-labelledby` link to its `Field.Label`: a native button trigger kept its name through
`<label for>`, but a trigger rendered as another element lost it.
