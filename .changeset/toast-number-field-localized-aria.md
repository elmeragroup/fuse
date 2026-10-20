---
"@elmeragroup/fuse": patch
---

`Toast.Viewport` names its region from the locale dictionary ("Varsler", "Aviseringar",
"Notifications", "Ilmoitukset") instead of Base UI's fixed English "Notifications"; an explicit
`aria-label` still wins. `NumberField` announces its input's role description in the provider
locale instead of the fixed English "Number field".
