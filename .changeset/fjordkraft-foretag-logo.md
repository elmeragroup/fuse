---
"@elmeragroup/fuse": minor
---

`@elmeragroup/fuse/icons` ships `FjordkraftForetagLogo`, the logo of the `fkab` themes.
`variant="full"`, the default, draws the Fjordkraft face beside "Fjordkraft Företag";
`variant="mark"` draws the face alone, the same mark as `FjordkraftLogo`'s. The whole logo paints in
`currentColor`, as `FjordkraftLogo` does.

`<BrandLogo brand="fkab" />` now draws the Fjordkraft Företag lockup. It drew `FjordkraftLogo`
before, so a page that showed it gets a wider logo, about 7.6 wide to 1 tall instead of 4.5 to 1.
Check the space its slot gives it. `<BrandLogo brand="fkab" variant="mark" />` is unchanged.
