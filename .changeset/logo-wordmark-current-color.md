---
"@elmeragroup/fuse": patch
---

The full logos of the energy brands in `@elmeragroup/fuse/icons` paint their lettering in
`currentColor`, as `ElmeraGroupLogo` and `FjordkraftLogo` already did, so the name takes the text
colour around it. Marks drawn in brand colours keep them. This changes the `variant="full"` artwork
of the four logos below; the `variant="mark"` artwork and `TrumfLogo` are unchanged:

- `TrondelagkraftLogo`: the letterforms and the lamp's ring and base were white. The lamp's
  yellow light stays yellow.
- `GudbrandsdalEnergiLogo`: the lettering was white. The orange gradient mark stays.
- `TelinetLogo`: "Telinet" was cyan and "Energi" navy. The dotted mark stays cyan.
- `NordicGreenEnergyLogo`: the lettering was dark green. The five-leaf mark stays.

Where a page relied on the old fixed ink, set that colour as the text colour around the logo, for
example white on a dark brand surface.
