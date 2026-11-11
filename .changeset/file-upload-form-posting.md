---
"@elmeragroup/fuse": minor
---

`FileUpload.Root` can post its files with a native form. Give it a `name` and the controlled `files`
it posts, and add each pick from `onSelect` to `files`; a submit or `new FormData(form)` then carries
exactly that list under `name`. A rejected pick never changes what is posted, and a native form
reset, including the one React runs after a form action, keeps the posted files. An enclosing
`Field.Root`'s `name` takes the place of the Root's own. A disabled Root posts nothing, and a Root
without `files` posts nothing as before; `name` without `files` is a type error.
