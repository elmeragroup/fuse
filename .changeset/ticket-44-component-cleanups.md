---
"@elmeragroup/ui": minor
---

Internal component cleanups with no rendered-output change: `Sidebar.Provider`'s `setOpen`/`toggleSidebar` are referentially stable (the cmd/ctrl+B listener subscribes once, and a `Sidebar.MenuButton` without a `tooltip` no longer re-renders on toggle), DatePicker's focused month and ConfirmButton's armed reset derive with reset instead of mirroring through `useEffect`, Meter resolves `mode` × `level` through one `METER_TONE_TABLE` behind a four-arm `tone` recipe axis (`METER_CONSTANTS` unchanged), Pagination's `Previous`/`Next` are one parameterised edge, Pagination/Breadcrumb drop their dead runtime `children` strips, `DescriptionList.Heading` stamps `data-slot` through `useRender` state, and per-render recipe calls are hoisted to module scope.

Removed: the no-op `prose` axis on `headingVariants` (and therefore the `prose` prop on `Heading`), which mapped to an empty class string and painted nothing.
