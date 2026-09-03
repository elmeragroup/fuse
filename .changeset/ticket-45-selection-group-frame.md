---
"@elmeragroup/ui": patch
---

Give the labeled selection groups one owner too: a package-private `SelectionGroupFrame` in `selection-item/`, rendered by `CheckboxGroup` and `RadioGroup`, plus the single `selectionGroupOrientationClass` map both families and the private card list now read, and one card-group body that `CheckboxItemGroup` and `RadioItemGroup` call with their own group as the parameter. The two families had three copies of the same two orientation strings and two copies of the fieldset skeleton between them. The redundant `errorMessage ? … : null` guards are gone — `Field.Error` already returns null for falsy children — and `CheckboxDescription`'s `describedBy` is `ReactNode` rather than the identity union `string | ReactNode`. No public export is added, no prop, default or public recipe changes, and `RadioGroup`'s header-row gate (row when `label || isPending`) is preserved exactly, empty legend and all.

PhoneNumberField becomes the fourth `FieldFrame` consumer, passing the `textFieldVariants` slots it already borrowed as the frame's class arguments. Its hidden submit input moves from after `Field.Error` into the frame's control slot, where it renders inside the content wrapper: `type="hidden"` paints no box and takes no flex slot, the description stays that wrapper's last child, and the input still submits `outputValue` under `name`.

Rendered class sets are unchanged part for part across all six components — both orientations, plain and card shapes, and the pending, disabled, read-only, required and invalid states.
