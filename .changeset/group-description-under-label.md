---
"@elmeragroup/fuse": patch
---

`CheckboxGroup`, `RadioGroup`, `CheckboxItemGroup` and `RadioItemGroup`: a labeled group's
`description` now sits directly under its label, with the 12px group gap before the options.
Before, it sat 24px under the label, as far as the options. A group without a description keeps
24px between its label and its options, and a group without a label keeps its spacing.
