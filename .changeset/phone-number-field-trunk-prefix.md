---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` keeps the trunk prefix of a national number on display as the user types, so a Swedish "0701234567" no longer loses its leading 0 on the next key. Without `formatOnType` the field shows the typed digits without separators; with it, libphonenumber's as-you-type format ("070-123 45 67"), which now also groups a partial number ("41 23 4"). A typed national number without its trunk prefix stays as typed rather than gaining one. A number detected from a `+` or `00` prefix keeps the national display it had, and a copied number that a space or parenthesis precedes, such as " +46 70…", is now detected too. The submitted value no longer counts a trunk prefix that libphonenumber read as part of the number behind the calling code, such as Kazakhstan's 8.
