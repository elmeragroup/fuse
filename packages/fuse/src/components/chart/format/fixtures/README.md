# Chart format fixtures

The chart format tests compare Fuse's labels with these files. No file here comes from Fuse code.

- `time-literals.ts` and `value-literals.ts` hold the labels written by hand. The format tests keep every hand-written label here, so every engine checks it.
- `time-judges.ts` compares Fuse's time labels with `slots.json`, the price files and the time literals. The slot label and date-time cases run through the public `formatChartSlot`. The one de-DE date-time is judged against the engine's own Intl output, because Fuse keeps Intl's join outside en, nb, sv and fi.
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

## Market data

The two price files are the verbatim HTTP bodies of one request each, fetched on 2026-10-17. Both sources mislabel one `time_end` on the fall-back day, so the tests place each row by its `time_start` plus the interval.

| File                                    | Source                                                               | SHA-256                                                            |
| --------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `elprisetjustnu/2025-10-26_SE3.json`    | `https://www.elprisetjustnu.se/api/v1/prices/2025/10-26_SE3.json`    | `565a7b62572a2f8e05a42f0cf28b81d7f111f294acf6b344f14f681996710d79` |
| `hvakosterstrommen/2025-10-26_NO1.json` | `https://www.hvakosterstrommen.no/api/v1/prices/2025/10-26_NO1.json` | `f5c2a9f6e6c21accd3bab2c6fd8d372281ee162fdbb08f245c5564dcdc0d09a4` |

## Attribution

- Swedish spot prices come from [elprisetjustnu.se](https://www.elprisetjustnu.se/), which takes them from ENTSO-E. Its API is free for anyone and asks for attribution.
- Norwegian spot prices come from [hvakosterstrommen.no](https://www.hvakosterstrommen.no/), which takes them from ENTSO-E. Its API is free for anyone and asks for attribution.
- The time zone rules come from the [IANA tz database](https://www.iana.org/time-zones), 2026c for `slots.json` and 2025c for `slot-starts.json`, which is in the public domain.
- The calendar names, zone names and interval patterns come from [Unicode CLDR](https://cldr.unicode.org/) 48.0.0. `LICENSE-CLDR` holds its Unicode License v3 notice, which must travel with the data.
