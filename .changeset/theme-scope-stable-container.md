---
"@elmeragroup/fuse": patch
---

`ThemeScope` no longer re-renders with a changed portal container when a Suspense boundary
around it hides and reveals its content. Each hide and reveal used to clear and set the
container, which in some hosts fed an update loop until React threw "Maximum update depth
exceeded". Attaching the scope element also no longer client-renders Suspense boundaries below
it that are still streaming. Overlays that are open inside the scope stay in it while the
boundary is hidden. A scope whose element is replaced provides the new element, and one whose
element leaves the document stops providing it.
