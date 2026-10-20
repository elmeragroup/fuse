---
"@elmeragroup/fuse": patch
---

A click on `InputGroup.Addon` chrome now focuses the group's own control, the Root's direct
`InputGroup.Input` or `InputGroup.Textarea`. Before, it focused the first input anywhere in the
group: nothing in a Textarea group, a field nested in an addon, or a PhoneNumberField's hidden
country input, which sent focus to the country picker.
