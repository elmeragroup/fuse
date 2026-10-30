# Chart format fixtures

The chart format tests compare Fuse's labels with these files. No file here comes from Fuse code.

- `time-literals.ts` and `value-literals.ts` hold the labels written by hand. The format tests keep every hand-written label here, so every engine checks it.
- `time-judges.ts` compares Fuse's time labels with `slots.json`, the fall-back day files and the time literals. The slot label and date-time cases run through the public `formatChartSlot`. The one de-DE date-time is judged against the engine's own Intl output, because Fuse keeps Intl's join outside en, nb, sv and fi.
- `slot-starts.json` holds the expected slot starts that `../slot-starts.test.ts` checks.
- `value-judges.ts` compares Fuse's value labels with the value literals. The public value cases run through `formatChartValue`.
- `judges.ts` lists every judge. `format.test.ts` runs them in Node, `format.engines.browser.test.ts` in Chromium, Firefox and WebKit, and `zone-probe.ts` under other process zones.

oxfmt skips the JSON files, so their bytes stay as fetched or generated.

## Slot labels

`slots.json` holds the expected slot lists and labels for Europe/Oslo, Europe/Stockholm and Europe/Helsinki in nb-NO, sv-SE, fi-FI and en-US. The charts v1 ground truth generated them with Python's `zoneinfo` module, the IANA tz database 2026c and the Unicode CLDR 48.0.0 JSON. Its `TIME-CONVENTIONS.md` defines every field and label rule.

`trim-slots.py` copies the fields the tests read, and computes nothing. Run it with the ground truth's `time/` folder as its argument.

```sh
python3 -I trim-slots.py <ground-truth>/time
```

It keeps the hourly, quarter-hour, daily, monthly and ISO week files, and merges the two golden-day files into the hourly and quarter-hour days. The script stops if a day in both files differs. Each day is a set of columns. A repeated slot's long zone names, which the spoken text uses, sit under `long_name` by slot index, and every other slot has none.

The ISO week words are drafts that await the owner's sign-off, as `meta.week_labels_status` says. Regenerate the file if the words change.

## Slot starts

`slot-starts.json` gives the expected start of eight slots, from a second to a year, for 1,528 instants in 19 zones. It samples every offset change from 2018 to 2025 in 17 of them, including Lord Howe, Chatham, Troll, Santiago, Havana, Beirut, Cairo, Asuncion, Sao Paulo, Amman and Tehran, plus Kolkata and Kathmandu, which never change. Two historic zones cover the cases that recent data lacks, and the file keeps every row of both.

- America/Toronto is sampled at two changes in 1919. A scan of every zone in tzdata from 1850 to 2038 found one skipped midnight whose gap does not start at midnight. Toronto jumped from 23:30 EST to 00:30 EDT at 1919-03-31T04:30Z, so neither candidate midnight exists and the day starts at the transition. Its fall-back from 24:00 EDT to 23:00 EST at 1919-10-26T04:00Z makes 1919-10-25 a 25-hour day.
- Africa/Monrovia is sampled at its change of 1972-01-07T00:44:30Z. Until then it kept −00:44:30, an offset with seconds, so its local midnight falls 30 seconds off the minute.

The file encodes one rule. A day, ISO week, month or year starts at the earliest instant of its first local date. When local midnight falls in a gap, that is the transition instant, and when midnight repeats, it is the first occurrence. A second, minute, quarter-hour or hour slot steps its fixed length from the start of its instant's local date, and a day whose length is no multiple of that length ends its last slot early, at the next day's start.

The data comes from the IANA tz database 2025c, through the PyPI `tzdata` package 2025.3. Its transitions in these zones match the 2025b that Node 24.13 bundles. Create a venv outside the repository once, then run the script from this folder with an empty `PYTHONTZPATH`, so `zoneinfo` reads the pinned package.

```sh
/usr/bin/python3 -m venv ~/.cache/fuse-slot-starts
~/.cache/fuse-slot-starts/bin/pip install tzdata==2025.3
PYTHONTZPATH= ~/.cache/fuse-slot-starts/bin/python3 -I slot_starts.py <ground-truth>/time
```

The optional argument is the ground truth's `time/` folder, which holds the Oslo golden day the script checks itself against. Without it the script skips that check and says so. It refuses to run against any other tz database release, and it leaves the JSON unchanged when one of its self-checks fails. Never edit the JSON by hand. Regenerate it.

## Price days

The two price days hold invented values in the shape of the elprisetjustnu.se API, because the real day-ahead prices may not be committed. `.scratch/charts-v1/tools/l05-oracles/write_price_days.py` in the charts v1 run wrote them from hourly values typed by hand plus a fixed offset per quarter. Only their slot starts come from the zone rules.

| File                                            | What it holds                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prices/fall-back-2025-10-26-quarter.json`      | The 100 Stockholm quarters of the fall-back day. The 02:45+02:00 quarter ends at 03:00+01:00, a 75-minute span, which is the mislabel the real source writes. |
| `prices/negative-spike-2026-05-24-quarter.json` | 96 Stockholm quarters with 16 negative quarters around midday and one spike in the evening.                                                                   |

The tests place each row by its `time_start` plus the interval and never read `time_end`.

## Elhub data

The Elhub files come from the Elhub Energy Data API, https://api.elhub.no, licensed under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. The charts v1 run froze the responses on 2026-10-17 and 2026-10-18, and the scripts in `.scratch/charts-v1/tools/l05-oracles/` trimmed them.

| File                                               | Dataset                                                               | What it holds                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `elhub/no1-household-hourly-2025-10_2026-09.json`  | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | 8,760 hourly values for NO1 households from 2025-10-01T00:00 to 2026-10-01T00:00 Oslo.                     |
| `elhub/no1-consumption-2025-10-26.json`            | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 25 hours of the fall-back day for the NO1 household and cabin groups.                                  |
| `elhub/no1-consumption-2026-03-29.json`            | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 23 hours of the spring-forward day for the same groups.                                                |
| `elhub/no1-consumption-2026-10-16.json`            | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 24 hours of a normal day for the same groups.                                                          |
| `elhub/no1-production-15min-2025-10-26.json`       | `PRODUCTION_PER_GROUP_MBA_15MIN`                                      | The 100 quarters of the fall-back day for NO1 hydro production.                                            |
| `elhub/no1-groups-2026-10-16.json`                 | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 24 hours of 16 October 2026 for all five NO1 consumption groups, in MWh to 3 decimals.                 |
| `elhub/no1-household-daily-2025-10.json`           | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 31 Oslo days of October 2025 for NO1 households, each with its total and its highest hour.             |
| `elhub/no1-household-daily-2024-10.json`           | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 31 Oslo days of October 2024, in the same shape.                                                       |
| `elhub/no1-household-monthly-2024-11_2026-10.json` | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 24 Oslo months from November 2024 to October 2026 for NO1 households. October 2026 runs to 16 October. |
| `elhub/no1-household-daily-2025-09.json`           | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | The 30 Oslo days of September 2025, in the shape of the other daily files.                                 |
| `elhub/no1-household-hourly-2025-09_2025-10.json`  | `CONSUMPTION_PER_GROUP_MBA_HOUR`                                      | 1,465 hourly values for NO1 households from 2025-09-01T00:00 to 2025-11-01T00:00 Oslo.                     |
| `elhub/no1-prosumer-2026-03-29.json`               | `PRODUCTION_PER_GROUP_MBA_15MIN` and `CONSUMPTION_PER_GROUP_MBA_HOUR` | A derived prosumer day: 92 quarters of solar energy and 23 hours of import and export.                     |

The day files keep the API's rows unchanged, with the fields `startTime`, `endTime`, `priceArea`, the group, `quantityKwh` and `meteringPointCount`. Elhub ends every row correctly, so the tests use them to cross-check the slot lists. The year file is computed. Each value is one hour's `quantityKwh` over its `meteringPointCount`, the mean per household meter, rounded to 4 decimals. It starts at `2025-09-30T22:00:00Z` and steps one hour per value, and it holds one 25-hour and one 23-hour day.

The group, daily and monthly files are computed too, by `trim_elhub_demos.py`, and the bar demos hold copies of them. The group file keeps each hour's `quantityKwh` per group in MWh. The daily and monthly files sum each hour's `quantityKwh` over its `meteringPointCount` per Oslo day or month. A daily total keeps 2 decimals, and the day's highest hour keeps 4 decimals with its `peakStart`. The group file keeps 3 decimals and a monthly total keeps 2, so each holds at least two more decimals than the demo prints. The script stops unless every day holds 23, 24 or 25 hours one hour apart.

`.scratch/charts-v1/tools/l07-oracles/trim_elhub_s12.py` writes September 2025's daily file and the two-month hourly file, in the shapes of the files above, for the composed month switch and its Sparklines. `trim_s19_prosumer.py` beside it derives the prosumer day, because Elhub serves no household prosumer series. It scales NO1 solar production so the day's highest quarter is a 5 kW household peak, as energy per quarter, and takes each hour's household consumption per meter less its quarters' solar energy as import above zero or export below it. Before it derives anything, it checks Elhub's own roll-up, each solar hour against the sum of its four quarters within 0.1 % or 1 kWh. The file names itself as derived.

## Attribution

- The consumption and production data come from the [Elhub Energy Data API](https://api.elhub.no), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- The time zone rules come from the [IANA tz database](https://www.iana.org/time-zones), 2026c for `slots.json` and 2025c for `slot-starts.json`, which is in the public domain.
- The calendar names, zone names and interval patterns come from [Unicode CLDR](https://cldr.unicode.org/) 48.0.0. `LICENSE-CLDR` holds its Unicode License v3 notice, which must travel with the data.
