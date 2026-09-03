---
"@elmeragroup/ui": minor
---

Close the shared overlay/field spine by deleting the last private copies of what it owns. Seventeen components hoisted their own `const selfFocusRing = focusRing({ target: "self" }).root()` and two called the `within` variant on every render; every one of them now imports the resolved `selfFocusRingClass` / `withinFocusRingClass` / `withinFocusRingControlClass` from `styles/utils`, which is the only module left that calls `focusRing` for those two targets. Checkbox, ConfirmButton, and the interim GridList drop their three copies of the same eight-line "is this `ReactNode` a string" helper for the shared `isTextNode`; the two `Object.prototype.toString.call(v) === "[object String]"` spellings that evaded the anti-slop rule in the packed-export check are honest, named `typeof` checks.

No public API change and no rendered-class change: the constants are the same expressions, resolved once per process instead of once per module, verified by comparing every affected component's rendered class attributes and every affected recipe's slot output before and after. `source-contracts.test.ts` now pins the five single-owner contracts the spine was built for — the focus-ring rungs, the `ThemeScope` portal guard, the popup class vocabulary, `createStringDictionary`, and `isTextNode` — so a private copy cannot grow back.

Size budgets are re-measured across the whole spine (tickets 29, 36–45). Ten entries came in under their recorded measurement and had their ceilings tightened by exactly the bytes lost: `card`, `input-group`, `checkbox-card`, `timeline-list`, `heading`, `react-aria/calendar`, `react-aria/range-calendar`, `react-aria/date-picker`, `react-aria/date-range-picker`, and `styles.css`. No ceiling was loosened.
