---
"@elmeragroup/fuse": patch
---

`DateField` centers its segment row in the field box again. The recipe's `input` slot carried `block`, which won the display conflict against the flex the shared field group applies, so the row sat flush against the top of the box: at `dense` the suite measured 15px of slack below the row and none above. Dropping `block` restores the centring at both densities.

`DateRangePicker` keeps one md inline inset between the en-dash and each date. Each date input inherited `DateField`'s 150px minimum width, so the start date's box grew past its content and the en-dash sat 84px from the date instead of 10px. The floor now applies only to a `DateField` that paints its own box.
