---
"@elmeragroup/fuse": minor
---

Adds checklist tasks and `Tour.Ring` to `@elmeragroup/fuse/tour`.

- `useTour` returns `startStep(step)`, which shows one step on its own as a task's tip, with a
  Done button that ends the run and writes no status; `completeStep(step)`, which marks a step
  done and completes the tour once every step is done; and `doneCount`.
- `useTourStepDone(tour, step)` answers whether one step is done, and re-renders only when that
  answer changes.
- Done steps sync across tabs and devices: a merge keeps every step either side marked done in
  the same version of the tour.
- `Tour.Ring`, placed inside `Tour.Popup`, outlines the step's element while the page stays usable.
  It follows the element through scrolling and takes no pointer, so the element stays clickable.
