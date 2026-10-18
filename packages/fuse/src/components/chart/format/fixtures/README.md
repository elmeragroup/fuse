# Chart format fixtures

The chart format tests compare Fuse's labels with these files. No file here comes from Fuse code.

- `time-literals.ts` and `value-literals.ts` hold the labels written by hand.
- `time-judges.ts` compares Fuse's time labels with `slots.json`, the price files and the time literals.
- `value-judges.ts` compares Fuse's value labels with the value literals.
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

## Market data

The two price files are the verbatim HTTP bodies of one request each, fetched on 2026-10-17. Both sources mislabel one `time_end` on the fall-back day, so the tests place each row by its `time_start` plus the interval.

| File                                    | Source                                                               | SHA-256                                                            |
| --------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `elprisetjustnu/2025-10-26_SE3.json`    | `https://www.elprisetjustnu.se/api/v1/prices/2025/10-26_SE3.json`    | `565a7b62572a2f8e05a42f0cf28b81d7f111f294acf6b344f14f681996710d79` |
| `hvakosterstrommen/2025-10-26_NO1.json` | `https://www.hvakosterstrommen.no/api/v1/prices/2025/10-26_NO1.json` | `f5c2a9f6e6c21accd3bab2c6fd8d372281ee162fdbb08f245c5564dcdc0d09a4` |

## Attribution

- Swedish spot prices come from [elprisetjustnu.se](https://www.elprisetjustnu.se/), which takes them from ENTSO-E. Its API is free for anyone and asks for attribution.
- Norwegian spot prices come from [hvakosterstrommen.no](https://www.hvakosterstrommen.no/), which takes them from ENTSO-E. Its API is free for anyone and asks for attribution.
- The time zone rules come from the [IANA tz database](https://www.iana.org/time-zones) 2026c, which is in the public domain.
- The calendar names, zone names and interval patterns come from [Unicode CLDR](https://cldr.unicode.org/) 48.0.0. `LICENSE-CLDR` holds its Unicode License v3 notice, which must travel with the data.
