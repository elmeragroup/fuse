---
"@elmeragroup/fuse": minor
---

`LocaleProvider` takes an optional `timeZone`, an IANA name such as `"Europe/Oslo"`, and
`useLocale()` returns it beside the locale. Pass the zone of the market your data describes. A
server and a browser in different zones then write the same dates, and the page hydrates without
a mismatch. An invalid name throws a `RangeError` when the provider renders.

`DataTable.Date`, `DataTable.DateTime` and the registered `DateCell` and `DateTimeCell` format in
the provider's zone. A cell's own `timeZone` still wins, and without either a cell formats in the
runtime's zone as before. Date cells now write every space as U+00A0, because Node and the browser
engines write different spaces for the same date, such as before the en-US day period, and one
differing space failed hydration. A test that matches a date cell's text by a plain space needs
U+00A0 there. WebKit still joins an en-US medium date-time with `at` and an sv-SE long one without
`kl.`, so those two styles can still mismatch between a Node server and Safari.
