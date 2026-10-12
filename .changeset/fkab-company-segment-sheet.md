---
"@elmeragroup/fuse": patch
---

External `fkab` (Fjordkraft Företag) now renders the Fjordkraft company look in light and dark, the same tokens as external `fkas` with `data-theme-segment="company"`. It previously took the orange Fjordkraft private palette, because the company segment sheets did not reach the `fkab` alias. `themes.css`, the theme catalog and the Figma variable values change for `external-fkab-company`; `--brand` still reads `--brand-fkab`.
