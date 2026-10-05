---
"@elmeragroup/fuse": patch
---

`InputGroup.Root` paints the field fill (`bg-card`) like `Input`. Before, it was transparent, so
wherever `--background` and `--card` differ (every external theme and the dark themes) an
InputGroup, and PhoneNumberField built on it, showed the page background while an `Input` beside
it was filled. A group on a surface that should show through, such as a sidebar, takes a
background class, for example `className="bg-background"`, which merges after the fill.
