---
"@elmeragroup/fuse": minor
---

Breaking for `FileTrigger` consumers: it moves to `@elmeragroup/fuse/file-trigger`, takes FileUpload's
prop names, and its `onSelect` receives a `File[]`. The **Migration** part at the end of this note
lists every change to make.

`FileTrigger` is a permanent component at `@elmeragroup/fuse/file-trigger`, also in the root barrel,
built on `FileUpload` instead of React Aria. A pick runs the same `accept` and count check as
`FileUpload`. It looks as before: a Fuse `Button` at `sm` with a leading paperclip, camera or
folder icon.

- `onSelect` receives a `File[]` of the files that pass, in a new array for each pick, which the
  next pick leaves intact.
- The new `onReject` receives the files that fail, each with a `reason`. A file that fails
  `accept` is rejected with `"type"`. Without `multiple`, when more than one file passes
  `accept`, each of those is rejected with `"count"`.
- It renders the button and a hidden file input and nothing around them, so it joins a
  `ButtonGroup`'s borders and corners as a `Button` does.
- It takes a `button`'s props, such as `aria-describedby`, which land on the visible button.

**Migration.** `@elmeragroup/fuse/react-aria/file-trigger` is removed. Import `FileTrigger` from
`@elmeragroup/fuse/file-trigger`, and rename its props to FileUpload's:

| Before                                    | After                      |
| ----------------------------------------- | -------------------------- |
| `acceptedFileTypes={["image/*", ".pdf"]}` | `accept="image/*,.pdf"`    |
| `allowsMultiple`                          | `multiple`                 |
| `acceptDirectory`                         | `directory` and `multiple` |
| `defaultCamera="user"`                    | `capture="user"`           |
| `isDisabled`                              | `disabled`                 |

`onSelect` received the input's `FileList`, or `null`; it now receives a `File[]` and runs only when
at least one file passes, so `[...(files ?? [])]` becomes `files`. A file that fails `accept` no
longer reaches `onSelect`. A folder pick without `multiple` rejects its files with `"count"` once
more than one of them passes `accept`, so pass `multiple` with `directory` to keep every file. `ref`
is now the visible button instead of the hidden input. `size` takes the label sizes `xs`, `sm`,
`default` and `lg`; the square `icon*` sizes are gone.
