---
"@elmeragroup/fuse": patch
---

`Button` and `ConfirmButton` keep Base UI's `aria-disabled` when they stay focusable while disabled (`focusableWhenDisabled` with `disabled` or `isPending`) or render a disabled non-native element. Before, the attribute was dropped and assistive tech announced an enabled button.
