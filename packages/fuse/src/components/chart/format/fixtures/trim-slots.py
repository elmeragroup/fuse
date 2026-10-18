#!/usr/bin/env python3
"""Trim the charts v1 zoneinfo oracle into slots.json for the format tests.

Run with the ground-truth folder as the only argument:

    python3 -I trim-slots.py <ground-truth>/time

The script copies fields verbatim and computes nothing. It keeps each slot's
UTC start and the labels the tests compare, and stores each day as columns.
It merges each sub-day file with its golden-day file, and stops when a day in
both files differs. A repeated slot's long zone names sit under its index.
"""

import json
import sys
from pathlib import Path

SOURCE = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent / "slots.json"
LOCALES = ["nb-NO", "sv-SE", "fi-FI", "en-US"]


def load(name):
    return json.loads((SOURCE / name).read_text(encoding="utf-8"))


def sub_day(slots):
    return {
        "utc_start": [s["utc_start"] for s in slots],
        "labels_canonical": {locale: [s["labels_canonical"][locale] for s in slots] for locale in LOCALES},
        "long_name": {
            str(index): {locale: s["repeated_hour_abbreviations"][locale]["long_name"] for locale in LOCALES}
            for index, s in enumerate(slots)
            if s["repeated"]
        },
    }


def sub_day_files(name, golden):
    days = {}
    for file in (name, golden):
        for zone, zone_days in load(file)["zones"].items():
            for day, slots in zone_days.items():
                trimmed = sub_day(slots)
                known = days.setdefault(zone, {}).get(day)
                if known is not None and known != trimmed:
                    sys.exit(f"{name} and {golden} disagree on {zone} {day}")
                days[zone][day] = trimmed
    return {zone: dict(sorted(zone_days.items())) for zone, zone_days in days.items()}


def periods(name, fields, extra=()):
    data = load(name)
    return {
        zone: {
            key: {
                "utc_start": [s["utc_start"] for s in slots],
                **{field: [s[field] for s in slots] for field in extra},
                "labels": {
                    locale: {field: [s["labels"][locale][field] for s in slots] for field in fields}
                    for locale in LOCALES
                },
            }
            for key, slots in groups.items()
        }
        for zone, groups in data["zones"].items()
    }


def weeks():
    data = load("slots-iso-weeks.json")
    return {
        zone: {
            "utc_start": [w["utc_start"] for w in rows],
            "labels_canonical": {
                locale: {field: [w["labels_canonical"][locale][field] for w in rows] for field in ["week", "spoken"]}
                for locale in LOCALES
            },
        }
        for zone, rows in data["zones"].items()
    }


meta = load("slots-hourly.json")["meta"]
out = {
    "meta": {
        "source": "charts v1 ground truth time/ generate.py, trimmed by trim-slots.py",
        "tzdata": meta["tzdata"],
        "cldr": meta["cldr"],
        "week_labels_status": load("slots-iso-weeks.json")["meta"]["labels_status"],
    },
    "hour": sub_day_files("slots-hourly.json", "slots-hourly-golden.json"),
    "quarter-hour": sub_day_files("slots-quarter-hour.json", "slots-quarter-hour-golden.json"),
    "day": periods("slots-daily.json", ["day", "weekday"], ["iso_week"]),
    "month": periods("slots-monthly.json", ["month", "month_year"]),
    "week": weeks(),
}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
