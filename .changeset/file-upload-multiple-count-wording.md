---
"@elmeragroup/fuse": patch
---

`FileUpload.Root`'s `multiple` documentation now states the rule a pick, drop or paste follows:
a file that fails `accept` is rejected with `"type"`, and `"count"` goes only to the files that pass
`accept`, when more than one does.
