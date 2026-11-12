---
"@elmeragroup/fuse": patch
---

`ConfirmButton` now swaps between its resting and armed labels on a page that Chrome's built-in
translation has translated. Each run of text in `children` and `armedChildren`, across fragments,
renders in one `<span>`. Before, swapping a text label for an element or a fragment threw
`NotFoundError`, and a text-to-text swap left the translated old label showing.
