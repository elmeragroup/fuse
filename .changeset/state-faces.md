---
"@elmeragroup/fuse": patch
---

Interactive controls now share one disabled and invalid look:

- **Disabled.** A disabled control dims to 50% and shows the `not-allowed` cursor.
  `Button isVisuallyDisabled` now dims to 50% instead of 70%. It also gets the
  `not-allowed` cursor and no longer changes on hover or press, but it still activates.
  A button with `aria-disabled="true"` looks the same. The look now comes from
  `aria-disabled`, so `isVisuallyDisabled` with an explicit `aria-disabled={false}` shows no
  disabled look. A disabled `CheckboxCard` now dims to 50% instead of 75% and shows the
  `not-allowed` cursor.
- **Tooltips.** Disabled controls no longer turn off pointer events, so a Tooltip on a
  disabled control opens on hover. That includes a natively disabled `Button` or `Toggle`.
  A disabled control still does not repaint, move or scale under the pointer. This fixes
  `RadioIconButton`, which used to change its fill on hover and shrink on press while
  disabled. `aria-disabled` Sidebar rows (including link rows such as
  `Sidebar.MenuSubButton href=… aria-disabled`) and `aria-disabled` Tabs triggers no longer
  block pointer events either, so they receive clicks and a link row navigates. Guard the
  action yourself where an `aria-disabled` control must not act.
- **Invalid.** Every invalid control paints an `--error` border and a 3px ring. `Toggle`
  and `RadioIconButton` now show that ring, and so do the React Aria date fields. A radio
  or checkbox inside an invalid group shows the same ring.
- **Groups.** A disabled `InputGroup` dims once. Its input is no longer dimmed again inside
  the dimmed group. `InputGroup` now paints its invalid ring only when its input or textarea
  is invalid. An invalid addon, such as a Button or Select inside the group, no longer rings
  the whole group. `Combobox.Chips` now dims as a whole when its input is disabled.
  Each chip no longer dims itself. An `InputGroup` whose input is `aria-disabled="true"` dims
  once as a whole too. A disabled `NumberField` now dims once as a whole and shows the
  `not-allowed` cursor over its input and steppers. A stepper disabled at its bound no longer
  dims on its own; it keeps its muted fill and shows a muted caret.
- **Other controls.** A disabled `Accordion.Trigger` and a disabled React Aria `Link` now
  dim, show the `not-allowed` cursor, and no longer underline or fade on hover. An
  `Accordion.Trigger`, `Select.Trigger`, `Input` or `Textarea` given `aria-disabled="true"`
  now dims and shows the `not-allowed` cursor as well. A disabled inline `TextField` no
  longer shows its border and fill when hovered.
