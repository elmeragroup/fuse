---
"@elmeragroup/fuse": patch
---

Public strings now use US spelling. The chart composition error code `scale-colour-on-stack` is now
`scale-color-on-stack`, the chart config type errors say "colors", and the skeleton reveal's
`MotionOutcome` value `"cancelled"` is now `"canceled"`. The chart error and warning messages and
the token and brand ramp descriptions use US spelling too. Code that matches the old error code or
outcome string must update it.
