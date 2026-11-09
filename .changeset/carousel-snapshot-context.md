---
"@elmeragroup/fuse": patch
---

Scrolling a `Carousel` no longer re-renders every part and every `useCarousel()` caller each time
the slides in view change. Only the slides and indicators that show what is in view re-render. A
carousel with many slides also spends less time per scroll and per content change: a slide finds
its number, and a change inside a slide is told apart, without scanning every slide.
