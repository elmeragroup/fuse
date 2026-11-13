---
"@elmeragroup/fuse": minor
---

`FileTrigger` is a permanent component at `@elmeragroup/fuse/file-trigger`, also in the root barrel,
built on `FileUpload`, with FileUpload's prop names (`accept`, `multiple`, `directory`, `capture`,
`disabled`). A pick runs the same `accept` and count check as
`FileUpload`. It looks as before: a Fuse `Button` at `sm` with a leading paperclip, camera or
folder icon.

- `onSelect` receives a `File[]` of the files that pass, in a new array for each pick, which the
  next pick leaves intact.
- The new `onReject` receives the files that fail, each with a `reason`. A file that fails
  `accept` is rejected with `"type"`. Without `multiple`, when more than one file passes
  `accept`, each of those is rejected with `"count"`.
- It renders the button and a hidden file input and nothing around them, so it joins a
  `ButtonGroup`'s borders and corners as a `Button` does.
- It takes a `button`'s props, such as `aria-describedby`, which land on the visible button, and
  `ref` is that button. The button carries `data-slot="file-trigger"`. `size` takes the label sizes
  `xs`, `sm`, `default` and `lg`.
- A folder pick (`directory`) without `multiple` rejects its files with `"count"` once more than
  one of them passes `accept`, so pass `multiple` with `directory` to keep every file.
