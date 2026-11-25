---
"@elmeragroup/fuse": minor
---

Adds `ScrollArea.Viewport`, the viewport of `ScrollArea.Root` as a part, for an area composed from
Base UI's `ScrollArea` parts. Tabbing into such an area now shows the same 2px focus outline as
`ScrollArea.Root`, just inside the area's edge, including in forced-colors mode. A visible
scrollbar thumb covers the outline where the thumb sits. With Base UI's own viewport, such an area
shows only the browser's default outline. The two-axis scrolling example uses the new part.

`Attachment.Group` draws the same outline inside its own edge. Its ring used to sit outside the
group, so a parent that clips, such as one with `overflow: hidden`, cut it off.
