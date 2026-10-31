# Chart demos

Each demo here and on the other chart pages is one file that holds its own data. A demo whose data would fill its printed source, such as a year of hourly values, reads one module under its page's `demos/data/` through a reviewed carve-out in `demo-imports.test.ts`, and `chart-demo-data.test.ts` compares that module with its package fixture.

## Attribution

The parity demos on the chart pages reuse the data rows and series labels of [evilcharts](https://github.com/legions-developer/evilcharts) examples at commit `ecbd6a5db7b25f9a7e070c02b2ef728c378eeb5c`. Each such demo names its example in a comment above its data. evilcharts is released under the MIT License, `Copyright (c) 2026 Gurbinder`. `LICENSE-evilcharts` holds the full licence text, copied unchanged, and it must travel with the data.
