---
"@elmeragroup/fuse": minor
---

`CheckboxItem`, `RadioItem` and `SelectionItem.Shell` rows now follow density. The label metrics,
`--label-text` and `--label-leading`, set the row's type: 14/20px dense, as
before, and 16/24px comfortable, the external default. `SelectionItem.Title` and
`SelectionItem.Description` take the size and keep their own line heights, and plain text in
`SelectionItem.Actions` or a `SelectionItem.SubSection` takes both. The control now centres on the
title's first line at either density, which moves it by up to 1.4px in a dense row. `Item` and
`Alert` keep `text-sm`. The Figma sync exports the pair as two more `Fuse density` variables.
