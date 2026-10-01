---
"@elmeragroup/fuse": minor
---

`Button` `isPending` keeps the button in the focus order and stamps `aria-busy`, so a keyboard user who activated an async action is still on the button when the result arrives; before, the native `disabled` attribute dropped focus to the document. Activation stays blocked. Pass `focusableWhenDisabled={false}` for the old native `disabled` behaviour. While pending, Button renders a spinning `SpinnerGap` in the leading icon position and hides its other direct SVG children, so a call site only passes `isPending`; remove hand-placed pending spinners, which would otherwise be hidden alongside the button's icon. `ConfirmButton` inherits both. Announce progress through the label or a `role="status"` region, since `aria-busy` alone says nothing.
