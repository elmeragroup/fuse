---
"@elmeragroup/ui": patch
---

`@elmeragroup/ui/dialog` now exports `DialogTitleProps`, so a host wrapping `Dialog.Title`
can type its own props — including the `isFocusable` opt-in the docs page already documents.
