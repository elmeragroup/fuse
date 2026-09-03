---
"@elmeragroup/ui": minor
---

Removed the `prose` prop from `Heading` (and from `TimelineList.Title`, which extends it). The axis mapped `true` to an empty class string, so it painted nothing and no code in this repository passed it; a future prose treatment would add it back with a class to paint.

Everything else here is internal and renders byte-identically: `Sidebar.Provider`'s `setOpen`/`toggleSidebar` are referentially stable (the cmd/ctrl+B listener subscribes once, and a `Sidebar.MenuButton` without a `tooltip` no longer re-renders when the rail toggles), DatePicker's focused month and ConfirmButton's armed reset derive with reset instead of mirroring through `useEffect`, Meter resolves `mode` × `level` through one `METER_TONE_TABLE` behind a four-arm `tone` recipe axis (`METER_CONSTANTS` unchanged), Pagination's `Previous`/`Next` are one parameterised edge, Pagination and Breadcrumb drop their dead runtime `children` strips, `DescriptionList.Heading` stamps `data-slot` through `useRender` state, and per-render recipe calls are hoisted to module scope.
