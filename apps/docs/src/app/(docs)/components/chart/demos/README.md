# Chart demos

Each demo here and on the other chart pages is one file that holds its own data. A demo whose data would fill its printed source, such as a year of hourly values, reads one module under its page's `demos/data/` through a reviewed carve-out in `demo-imports.test.ts`, and `chart-demo-data.test.ts` compares that module with its package fixture.

Every demo draws power and electricity data, such as consumption in kWh, spot prices in øre/kWh and bills in kr, for a brand-neutral Nordic household or market.
