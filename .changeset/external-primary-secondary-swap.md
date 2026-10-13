---
"@elmeragroup/fuse": patch
---

External themes for Fjordkraft (`fkas`) in both segments, Fjordkraft Företag (`fkab`, which
follows `fkas`), TrøndelagKraft (`tkas`), Gudbrandsdal Energi (`guen`), Telinet (`fkse`) and
Elmera (`elma`) swap their primary and secondary color roles in light and dark, which they had
the wrong way round. `--primary` now takes the text color and `--secondary` the brand color, so
the default Button fills with the text color and the secondary Button with the brand color.
`--primary-foreground`, `--primary-soft` and `--primary-soft-foreground` swap with their
`--secondary-*` partners as well. `--secondary-hover` follows the new `--secondary`.

Host apps that use `bg-primary`, `text-primary`, `bg-secondary` or the other primary and secondary
utilities in these themes change color too. The link Button colors its text with `--primary`, so
in these themes it reads as plain text until hover underlines it. Nordic Green Energy (`ngfi`) and
the internal themes keep their colors.
