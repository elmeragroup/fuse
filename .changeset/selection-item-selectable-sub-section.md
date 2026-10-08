---
"@elmeragroup/fuse": minor
---

`CheckboxItem`, `RadioItem` and `SelectionItem.Shell` take `isSubSectionSelectable`. With it, a
click on a `SelectionItem.SubSection`'s text, its band or the padding beside it toggles the
control, so a card whose option is described in a SubSection selects from anywhere on the card.
Links, buttons, form fields, labels and other focusable elements in the SubSection keep their
own clicks, and a click that ends a text selection does nothing. The control's accessible name
stays the label row, and the keyboard still toggles through the control. It is off by default,
because a SubSection that reveals fields under a checkbox should not clear it when the user
clicks between them.
