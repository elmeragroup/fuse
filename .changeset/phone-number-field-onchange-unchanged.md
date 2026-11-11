---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` no longer calls `onChange` when a proposal's output equals the value the parent
already holds: the `value` prop of a controlled field, compared exactly, or the output an
uncontrolled field already shows. Deleting the separator in "41 23 45 67" used to send
`"+4741234567"` again; now it calls nothing, and the display re-formats with the caret where it was.
A parent that stores another form of the number, such as national digits, still gets every call.
The same rule covers typing, paste, country picks (a pick that clears an already empty number
calls nothing) and the call as hydration commits.
