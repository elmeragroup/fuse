---
"@elmeragroup/fuse": minor
---

`CheckboxItem` and `RadioItem` now forward root attributes such as `id`, `style`, `data-testid`,
other `data-*` attributes, ARIA attributes and event handlers to the row's `Field.Item` root,
the element that carries `data-slot="checkbox-item"` or `"radio-item"`. Before, the row dropped
them, so a test or an analytics hook had to rebuild the row from `SelectionItem.Shell`.
`getByTestId("plan-fixed").getByRole("checkbox")` now reaches a row's control. The row keeps
its own `data-slot` and wiring, and `isDisabled` stays the one way to disable it.
