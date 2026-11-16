---
"@elmeragroup/fuse": minor
---

Adds the `@elmeragroup/fuse/tour` preview entry for product tours: a run of popups that point at
parts of a page, one step at a time. Names and props can change until Fuse's first stable release.

- `defineTour` declares a tour's id, version and steps. The step ids become a union type, so a part
  that names an unknown step fails to compile.
- `Tour.Provider` holds the session and renders only its children. A run re-renders only the tour
  parts and hooks whose answer changes.
- `Tour.Target` and `useTourStep` register a step's element with its words. A plain-HTML element
  takes `data-tour-step="<tourId>.<stepId>"`.
- `Tour.Popup` is the coachmark, a labeled `dialog` with `Tour.Header`, `Tour.Progress`,
  `Tour.Close`, `Tour.Title`, `Tour.Description`, `Tour.Footer`, `Tour.Skip`, `Tour.Prev` and
  `Tour.Next`. The Arrow keys move between steps.
- `useTour` reads a tour's state and starts it; `useAutoStartTour` starts it once it is due, by
  `priority` and the Provider's `autoStartCooldownMs`.
- Records persist in localStorage by default. `memoryTourStorage`, `remoteTourStorage` and
  `layeredTourStorage` cover demos and backends, and `parseTourCookie` and `serializeTourCookie`
  let a server render finished tours from the first paint through `initialRecords`.
- A tour never throws into the page. Only Done on the last step, Skip, Close and Escape write a
  status; an outside press or an error ends the run for the page only.
