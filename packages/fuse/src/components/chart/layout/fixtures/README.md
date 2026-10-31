# Chart layout fixtures

The layout tests compare Fuse's scales, stacks, ticks and slots with these files. No file here comes from Fuse code. Scripts under `.scratch/charts-v1/tools/l05-oracles/` write them from the charts ground truth, and only their output is committed.

## d3's own tests

`d3/` holds assertions from the upstream test files of d3-scale 4.0.2, d3-array 3.2.4 and d3-shape 3.2.0, as the charts ground truth extracted them. Each case keeps its test name, source line, expression, setup statements and the expected value the d3 author wrote by hand. `trim_d3_cases.py` copies them here, and `d3-cases.ts` replays each expression against a d3-shaped facade over Fuse's functions in `d3-facade.ts`.

The three packages are released under the ISC licence. Each folder holds its package's `LICENSE`, which must travel with the cases.

## Value domains

`value-domains.json` holds the expected domain and ticks for every count-5 case of the ground truth's `ticks/cases.json`. `value_domain_oracle.py` writes it with a Python port of d3-array's `nice` and `ticks` and CONTRACT section 8.2's widening rule for flat ranges.

## Label widths

`roboto-advances-12px.json` holds Roboto Regular's advance widths at 12 px, read from the `hmtx` table of `@fontsource/roboto` 5.3.0's latin WOFF file by `roboto_advances.py`. `label-width.ts` must hold the same table.

## Slot judges

`slot-judges.ts` compares the time axis's slots with the zoneinfo slot lists in `../../format/fixtures/slots.json`. `../x-domain.zones.test.ts` runs them in the unit project's zone and again in each zone project's.
