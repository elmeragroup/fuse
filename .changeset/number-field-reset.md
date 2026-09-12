---
"@elmeragroup/ui": patch
---

Native form reset now restores an uncontrolled `NumberField`'s `defaultValue` (or clears it when there is none) without calling `onChange`, matching the other field composites. A controlled `value` stays parent-owned.
