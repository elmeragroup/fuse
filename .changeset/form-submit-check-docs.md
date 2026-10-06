---
"@elmeragroup/fuse": patch
---

`Form`'s JSDoc now says that every submit stops while a Field inside it is invalid: an `errors`
entry counts until its own field changes, and `invalid` for as long as it is passed. When a
change elsewhere can make a field valid, as with rules in a schema, use a plain
`<form noValidate>` and pass each field `isInvalid` and `errorMessage`. The Form page shows
that path.
