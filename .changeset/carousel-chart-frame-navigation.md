---
"@elmeragroup/fuse": patch
---

After a same-origin iframe that shows a `Carousel` loads a document from another origin, the
carousel's unmount no longer throws a `SecurityError`. The error stopped its cleanup, so the timer
that waits for a scroll to settle kept running after an unmount under held input. The carousel no
longer cancels animation frames through the iframe's window once it shows another document, where
the cancel could hit one of that document's frames.

`Chart.Tooltip` gets the same fix in the watch that opens a default item's popup while the plot is
in view, and in the glide that moves the popup. An open tooltip can still throw from Base UI's
popup positioning when it unmounts after such a navigation (#1134).
