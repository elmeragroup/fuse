---
"@elmeragroup/fuse": patch
---

TrøndelagKraft's external radius is now `1rem` (16px), up from `0.95rem` (15.2px), for `--radius` and `--radius-button`.
The old value came from an early theming commit in the sales flow and had no design source. Every corner that follows the
brand radius moves by 0.8px or less: cards, badges and buttons round at 16px, and the `rounded-*` scale steps from 10px to
20px.
