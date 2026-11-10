# Chart demos

Each demo here and on the other chart pages is one file that holds its own data. A demo whose data would fill its printed source, such as a year of hourly values, reads one module under its page's `demos/data/` through a reviewed carve-out in `demo-imports.test.ts`.

Every demo draws power and electricity data, such as consumption in kWh, spot prices in øre/kWh and bills in kr, for a brand-neutral Nordic household or market.
