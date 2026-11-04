---
"@elmeragroup/fuse": patch
---

The Fjordkraft and TrøndelagKraft marks in `@elmeragroup/fuse/icons` paint in `currentColor`, as their full logos already do, so `variant="mark"` shows on a light surface such as a white header or a menu. They were white:

- `FjordkraftLogo` and `BrandLogo` with `fkas` or `fkab`: the face takes the text colour.
- `TrondelagkraftLogo` and `BrandLogo` with `tkas`: the lamp's ring and base take the text colour, and its light uses the full logo's yellow, `#FCE300`, in place of `#FFF400`.

The other marks keep their brand colours. Where a page drew one of these marks on a brand-coloured tile, set the tile's text colour with its background, for example `bg-brand text-brand-foreground`, to keep the mark white.
