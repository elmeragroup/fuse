---
"@elmeragroup/fuse": minor
---

Add `FileUpload`.

- `FileUpload`, from `@elmeragroup/fuse/file-upload` and the root barrel, takes files from the
  picker, a drop, a paste and `useFileUpload().actions.add`. Every source runs one check.
  `onSelect` receives the files that pass, in a new array for each call. `onReject` receives the
  rest, each with a `reason`: `"type"`, `"count"`, `"directory"` or `"unreadable"`.
- `Root` takes `accept` in the attribute's syntax, `multiple`, `directory`, `capture` and
  `disabled`, and renders the hidden file input with no `name`. A Root without `multiple` rejects
  every file with `"count"` when more than one passes `accept`.
- `Dropzone` sets `data-drop-target` while a file drag that can drop is over it, shows the
  not-allowed cursor when the drop is certain to fail, and opens the picker from a click on its
  empty surface. A dropped folder expands into its files, each with a `webkitRelativePath`.
- `Trigger` is a `button` that opens the picker, and `render={<Button size="sm" />}` gives it the
  Fuse look. `Description` describes every Trigger in its Root.
- A paste adds its files while focus is inside the Root, outside a text field.
- While a Root is mounted, a file dropped outside every Dropzone no longer opens in the tab.
