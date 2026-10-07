---
"@elmeragroup/fuse": patch
---

`Item.Footer mode="hidden"`, and with it `SelectionItem.SubSection`, `CheckboxItem.SubSection`
and `RadioItem.SubSection`, clips its content. The collapsed row was 0px, but its content kept its
full height and overflowed invisibly, so a hidden form in the last option of a list added blank
scroll past the end of the page, or a scrollbar with nothing to scroll inside a Sheet or Dialog.
Only hidden mode clips, so a visible footer still paints focus rings whole. Hiding a footer now
removes its content with the row instead of fading it out; a reveal still fades and slides in.
