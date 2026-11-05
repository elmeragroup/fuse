---
"@elmeragroup/fuse": minor
---

Add `Carousel`, and the `Pause` and `Play` icons.

- `Carousel`, from `@elmeragroup/fuse/carousel` and the root barrel, scrolls its slides with the
  browser's own scroll snapping, so a swipe, wheel, trackpad or arrow key works as on any
  scroller and a flick stops at the next slide. It adds no runtime dependency.
- `Root` is a region with the role description "carousel" and requires `aria-label` or
  `aria-labelledby`. It takes `index`, `defaultIndex`, `onIndexChange(index, { reason })` and
  `orientation`. `Viewport` holds the `Slide`s. Each slide is a group named by its place, such as
  "3 of 6", and a slide out of view is `inert`.
- `Controls` lays out `Previous`, `Indicators` and `Next` in one centred row. Previous and Next
  disable at the ends and stay focusable. `Indicators` renders one `Indicator` per page, a dot
  that becomes a pill on the current page, `aria-disabled` there as the APG grouped carousel asks;
  map your own `Indicator index={i}` for thumbnails. `Status` shows "3 of 6" in the locale.
- `Autoplay delay={ms}` rotates the pages and renders the APG rotation control. Rotation starts
  paused under reduced motion, pauses on hover and a hidden tab, and stops for good on keyboard
  focus anywhere in the carousel, the rotation control included, and on a swipe, a drag, a wheel
  turn or a control press. Only the rotation control starts it again; after that press, focus and
  hover no longer stop or pause it. A new `delay` keeps the user's choice. An `Autoplay`, mounted
  with the carousel or later, starts paused under a pointer already over the carousel, hover from
  before hydration included where the primary pointer can hover, and stopped with keyboard focus
  already inside it, an `autoFocus` field's included. Keyboard focus inside a portal, a
  same-origin frame's included, or a custom element's open shadow root counts as focus in the
  carousel.
- A consumer `onClick` on `Previous`, `Next`, `Indicator` or `Autoplay` can cancel the control's
  own action with `event.preventBaseUIHandler()`.
- `useCarousel()` gives custom controls the carousel's `state`, `actions` and `meta`.
- The strings come in all four locales. The slides do not loop.
- `@elmeragroup/fuse/icons` adds `Pause` and `Play`.
