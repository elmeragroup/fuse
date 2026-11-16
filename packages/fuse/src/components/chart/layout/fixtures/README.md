# Chart layout fixtures

The layout tests compare Fuse's scales, stacks, ticks and slots with these files. No file here comes from Fuse code. They were written outside Fuse, and only the output is committed.

## d3's own tests

`d3/` holds assertions from the upstream test files of d3-scale 4.0.2, d3-array 3.2.4 and d3-shape 3.2.0, extracted outside Fuse. Each case keeps its test name, source line, expression, setup statements and the expected value the d3 author wrote by hand. `d3-cases.ts` replays each expression against a d3-shaped facade over Fuse's functions in `d3-facade.ts`.

`d3/d3-shape/` also holds d3-shape 3.2.0's `arc` and `pie` cases, which judge the polar layouts, in the same trimmed form. `d3-polar-facade.ts` gives d3's chainable `arc` and `pie` over Fuse's polar functions. It turns the cases' radians into Fuse's degrees and back, so their replay compares numbers within a relative 1e-12. A case that asserts with `assertPathEqual` compares both paths after d3's own normalization, which `d3-cases.ts` exports as `normalizePath`.

The three packages are released under the ISC license. Each folder holds its package's `LICENSE`, which must travel with the cases.

## Value domains

`value-domains.json` holds the expected domain and ticks for every tick case with a count of 5. A Python port of d3-array's `nice` and `ticks` computed them, with the value axis's widening rule for flat ranges.

## Label widths

`roboto-advances-12px.json` holds Roboto Regular's advance widths at 12 px, read from the `hmtx` table of `@fontsource/roboto` 5.3.0's latin WOFF file. `label-width.ts` must hold the same table.

`inter-advances-12px.json`, `dejavu-sans-advances-12px.json` and `liberation-sans-advances-12px.json` hold the same characters' advances in Inter Regular (`@fontsource/inter` 5.3.0's latin WOFF), DejaVu Sans (Ubuntu 24.04's `fonts-dejavu-core` 2.37-8) and Liberation Sans Regular (`fonts-liberation` 2.1.5-3). Each holds a character's default glyph under `advances` and its `tnum` substitute under `tabular`, since ring values set tabular figures. fontTools read them, and Roboto's file holds the same table as `roboto-advances-12px.json`. `label-bound.ts` must hold each character's widest advance across the four faces, rounded up to a whole pixel.

## Slot judges

`slot-judges.ts` compares the time axis's slots with the zoneinfo slot lists in `../../format/fixtures/slots.json`. `../x-domain.test.ts` runs them in the unit project's zone.
