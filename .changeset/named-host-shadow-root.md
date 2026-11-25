---
"@elmeragroup/fuse": patch
---

A page whose document exposes a `host` property through named access, as it does for one
`<form name="host">`, no longer freezes the tab. Before, Fuse read such a document as a shadow root.
Its walks out of shadow roots stepped from the document to its `host` and back to the document
without end. With two such elements, `document.host` is an `HTMLCollection` and the walk threw.
Date picker and `RangeCalendar` focus handling, `ListDetail`, `Calendar` keyboard navigation,
`ActionBar`, `Carousel` rotation, `DataTableFilter` and paste into `FileUpload` ran these walks.
`FileUpload.Root` also took a paste while focus was outside it, when the element named `host` sat
inside the Root.
