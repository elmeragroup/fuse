---
"@elmeragroup/fuse": minor
---

`Select.Content`: the list scrolls inside the popup now, where Base UI reads the scroll position.
A long list in a popup that opens beside the trigger shows its scroll arrows, and hovering one
scrolls the list. That covers `alignItemWithTrigger={false}` and the default whenever Base UI
falls back from aligning, such as when the popup does not fit over the trigger. Before, that popup
scrolled itself and its arrows never appeared. The arrows appear when a mouse or the keyboard opens
the popup. On touch input, Base UI hides them, and the list scrolls natively.

The arrows `Select.Content` renders now sit inside the list, so a wheel gesture over an arrow
scrolls the list. The list also keeps scroll padding the height of an arrow, 24px, so the option
the keyboard highlights stays clear of the arrow at either end. Before, in a popup aligned with the
trigger, arrowing down a long list moved the highlighted option under the down arrow.

**Breaking:** an `onScroll` or `onScrollEnd` on the element passed to `Select.Content`'s `render`
no longer fires, because the popup no longer scrolls. Pass the listener to `Select.Content`'s
`onScroll` or `onScrollEnd`, which fire when the list scrolls and when it stops. Their
`event.currentTarget` is now the list, where it was the popup. `onScrollEnd` forwards the native
`scrollend` event, which Chrome fires from 114 and Safari from 26.2, so it does not fire in
Chrome 111 to 113 or Safari 16.4 to 26.1.
