#!/usr/bin/env python3
"""Generate the expected slot starts for the Fuse charts v1 run.

This script is an oracle. It uses only the Python standard library, plus the
pinned tzdata package as zone data. It never reads Fuse code and never runs
JavaScript. It finds each local day start by scanning UTC instants, not through
the fold attribute, so it shares no conversion logic with the code under test.

Run it with the venv beside it, with PYTHONTZPATH set to the empty string so
that zoneinfo reads the pinned tzdata package:

    PYTHONTZPATH= .venv/bin/python3 -I slot_starts.py [<ground-truth>/time]

One run computes every sample twice. The pinned source is tzdata 2025c, which
Node 24.14 bundles. CI runs Node 24.13.0 with tzdata 2025b, which has the same
transitions for every zone here. The system source is /usr/share/zoneinfo, which
is 2026c on this machine. The script keeps a row only when both sources agree, writes
slot-starts.json next to itself and exits non-zero when a self-check fails.
README.md states the rule.
"""

from __future__ import annotations

import json
import sys
import zoneinfo
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "slot-starts.json"
# The charts v1 ground truth keeps slots-hourly-golden.json one folder up. A copy
# of this script elsewhere takes that folder as its first argument, or skips the
# golden check when it has none.
GOLDEN_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent
GOLDEN = GOLDEN_DIR / "slots-hourly-golden.json"
SYSTEM_TZDIR = Path("/usr/share/zoneinfo")
PINNED_IANA = "2025c"
SIZE_LIMIT = 200_000  # bytes, including the final newline

UTC = timezone.utc
WINDOW_START = datetime(2018, 1, 1, tzinfo=UTC)
WINDOW_END = datetime(2026, 1, 1, tzinfo=UTC)  # exclusive, so 2025-12-31 is in
# Paraguay moved to a permanent -03 after its 2024-10-06 change, and tzdata
# releases before 2024b still hold the old rules after that date, so only
# transitions up to and including 2024-10-06 count.
TRANSITION_CUTOFF = {"America/Asuncion": datetime(2024, 10, 7, tzinfo=UTC)}

ZONES = [
    "Europe/Oslo",
    "America/New_York",
    "Asia/Kolkata",
    "Asia/Kathmandu",
    "Australia/Lord_Howe",
    "Pacific/Chatham",
    "Australia/Adelaide",
    "America/St_Johns",
    "Antarctica/Troll",
    "America/Santiago",
    "America/Havana",
    "Asia/Beirut",
    "Africa/Cairo",
    "America/Asuncion",
    "America/Sao_Paulo",
    "Asia/Amman",
    "Asia/Tehran",
    "America/Toronto",
    "Africa/Monrovia",
]
# Zones sampled only at these historic transitions. A scan of every zone in
# tzdata from 1850 to 2038 found one skipped midnight whose gap does not start
# at midnight. Toronto jumped from 23:30 EST to 00:30 EDT at 1919-03-31T04:30Z,
# so 1919-03-31 starts at that transition, and no candidate midnight exists.
# Its fall-back at 1919-10-26T04:00Z went from 24:00 EDT to 23:00 EST, so
# 1919-10-25 lasts 25 hours and 1919-10-26 starts at 05:00Z.
# Monrovia kept an offset of -00:44:30 until 1972-01-07T00:44:30Z, when it
# moved to GMT. Its day starts fall on a whole second that is not a whole
# minute, and its last change skips 00:00 to 00:44:30 on 1972-01-07.
HISTORIC_ANCHORS = {
    "America/Toronto": [datetime(1919, 3, 31, 4, 30, tzinfo=UTC), datetime(1919, 10, 26, 4, 0, tzinfo=UTC)],
    "Africa/Monrovia": [datetime(1972, 1, 7, 0, 44, 30, tzinfo=UTC)],
}
# Zones with a fixed offset get pseudo transitions at the local midnight that
# starts each of these days. They are a year start on a Monday, a month start
# after a leap day, a plain Monday and a month start on a Monday.
FIXED_ZONES = {"Asia/Kolkata", "Asia/Kathmandu"}
FIXED_DAYS = [date(2018, 1, 1), date(2020, 3, 1), date(2023, 5, 15), date(2025, 12, 1)]

OFFSET_MINUTES = [-61, -31, -1, 0, 1, 29, 31, 61]
INTERVALS = ["second", "minute", "quarter", "hour", "day", "week", "month", "year"]
FIXED_LENGTHS = {"second": 1, "minute": 60, "quarter": 900, "hour": 3600}

RULE = [
    "dayStart(D, Z) is the earliest instant whose local calendar date in zone Z is D. "
    "This matches Temporal's ZonedDateTime.prototype.startOfDay(). When midnight falls "
    "in a gap, it is the transition instant. When midnight repeats, it is its first "
    "occurrence.",
    "Day slots start at dayStart(D). An ISO week starts at dayStart of its Monday. A month "
    "starts at dayStart of its first day, and a year at dayStart of 1 January.",
    "Second, minute, quarter-hour and hour slots step a fixed duration len of 1 s, 60 s, "
    "900 s or 3600 s from dayStart(D). The start is dayStart(D) + floor((t - dayStart(D)) "
    "/ len) * len. When a day's length is not a multiple of len, its last slot ends early "
    "at dayStart(D + 1).",
    "D is the local date of t in every case. A day slot, an ISO week, a month and a year "
    "contain t, and the self-checks confirm that dayStart(D) <= t < dayStart(D + 1).",
]


# ---------------------------------------------------------------------------
# Zone sources


def pinned_zone(key: str) -> zoneinfo.ZoneInfo:
    return zoneinfo.ZoneInfo(key)


def system_zone(key: str) -> zoneinfo.ZoneInfo:
    with open(SYSTEM_TZDIR / key, "rb") as handle:
        return zoneinfo.ZoneInfo.from_file(handle, key=key)


def pinned_version() -> str:
    if zoneinfo.TZPATH != ():
        raise SystemExit(
            "zoneinfo.TZPATH is not empty. Run with PYTHONTZPATH= so the pinned tzdata "
            f"package is the only source. TZPATH is {zoneinfo.TZPATH}."
        )
    try:
        import tzdata  # noqa: PLC0415
    except ImportError as error:
        raise SystemExit("the tzdata package is missing. Run with .venv/bin/python3.") from error
    if tzdata.IANA_VERSION != PINNED_IANA:
        raise SystemExit(f"tzdata is {tzdata.IANA_VERSION}, expected {PINNED_IANA}")
    return f"{tzdata.IANA_VERSION} (PyPI tzdata {tzdata.__version__})"


def system_version() -> str:
    return f"{(SYSTEM_TZDIR / '+VERSION').read_text().strip()} ({SYSTEM_TZDIR})"


class Zone:
    """One zone from one tz source, with cached local dates and day starts."""

    def __init__(self, tz: zoneinfo.ZoneInfo) -> None:
        self.tz = tz
        self.day_starts: dict[date, int] = {}

    def local(self, seconds: int) -> datetime:
        return datetime.fromtimestamp(seconds, self.tz)

    def local_date(self, seconds: int) -> date:
        return self.local(seconds).date()

    def offset(self, seconds: int) -> timedelta:
        return self.local(seconds).utcoffset()

    def day_start(self, day: date) -> int:
        """The earliest instant whose local date is day, by brute-force scan."""
        if day in self.day_starts:
            return self.day_starts[day]
        base = int(datetime(day.year, day.month, day.day, tzinfo=UTC).timestamp())
        low, high = base - 15 * 3600, base + 15 * 3600
        if self.local_date(low) >= day:
            raise SystemExit(f"the scan for {day} starts inside the day")
        minute = next((m for m in range(low, high + 1, 60) if self.local_date(m) == day), None)
        if minute is None:
            raise SystemExit(f"{day} has no instant in the scan window")
        start = next(s for s in range(minute - 59, minute + 1) if self.local_date(s) == day)
        self.day_starts[day] = start
        return start


# ---------------------------------------------------------------------------
# The rule


def next_month(day: date) -> date:
    return date(day.year + (day.month == 12), day.month % 12 + 1, 1)


def slots(zone: Zone, seconds: int) -> list[tuple[int, int]]:
    """(start, end) in seconds for each interval in INTERVALS order."""
    day = zone.local_date(seconds)
    day_start = zone.day_start(day)
    next_day_start = zone.day_start(day + timedelta(days=1))
    out = []
    for name in INTERVALS[:4]:
        length = FIXED_LENGTHS[name]
        start = day_start + (seconds - day_start) // length * length
        out.append((start, min(start + length, next_day_start)))
    out.append((day_start, next_day_start))
    monday = day - timedelta(days=day.weekday())
    out.append((zone.day_start(monday), zone.day_start(monday + timedelta(days=7))))
    first = day.replace(day=1)
    out.append((zone.day_start(first), zone.day_start(next_month(first))))
    out.append((zone.day_start(date(day.year, 1, 1)), zone.day_start(date(day.year + 1, 1, 1))))
    return out


# ---------------------------------------------------------------------------
# Transitions and samples


def transitions(key: str, zone: Zone) -> list[int]:
    if key in FIXED_ZONES:
        return []
    if key in HISTORIC_ANCHORS:
        found = []
        for moment in HISTORIC_ANCHORS[key]:
            seconds = int(moment.timestamp())
            if zone.offset(seconds - 1) == zone.offset(seconds):
                raise SystemExit(f"{key} has no transition at {moment.isoformat()}")
            found.append(seconds)
        return found
    found = []
    stop = int(TRANSITION_CUTOFF.get(key, WINDOW_END).timestamp())
    hour = int(WINDOW_START.timestamp())
    while hour < stop:
        if zone.offset(hour) != zone.offset(hour + 3600):
            low, high = hour, hour + 3600
            while high - low > 1:
                middle = (low + high) // 2
                if zone.offset(middle) == zone.offset(low):
                    low = middle
                else:
                    high = middle
            if high < stop:
                found.append(high)
        hour += 3600
    return found


def anchors(key: str, zone: Zone) -> list[int]:
    if key in FIXED_ZONES:
        return [zone.day_start(day) for day in FIXED_DAYS]
    return transitions(key, zone)


def minute_45(zone: Zone, anchor: int) -> int:
    """The first instant near the anchor whose wall time is HH:45 in the anchor's hour."""
    for hour in (zone.local(anchor).hour, zone.local(anchor - 1).hour):
        for seconds in range(anchor - 3600, anchor + 3601, 60):
            wall = zone.local(seconds)
            if wall.hour == hour and wall.minute == 45 and wall.second == 0:
                return seconds
    raise SystemExit(f"no HH:45 instant near {anchor}")


def samples(zone: Zone, anchor: int) -> set[int]:
    out = {anchor + minutes * 60 for minutes in OFFSET_MINUTES}
    for day in {zone.local_date(anchor - 1), zone.local_date(anchor)}:
        for midnight in (zone.day_start(day), zone.day_start(day + timedelta(days=1))):
            out.update((midnight - 1, midnight, midnight + 1))
    out.add(minute_45(zone, anchor))
    return out


# ---------------------------------------------------------------------------
# Self-checks

FAILURES: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        FAILURES.append(message)


def iso(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(text: str) -> int:
    return int(datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).timestamp())


def check_row(label: str, seconds: int, row: list[tuple[int, int]]) -> None:
    by_name = dict(zip(INTERVALS, row))
    for name, (start, end) in by_name.items():
        check(start <= seconds, f"{label} {iso(seconds)}: {name} start {iso(start)} is after t")
        check(seconds < end, f"{label} {iso(seconds)}: t is not before the {name} end {iso(end)}")
    chains = [
        ["year", "month", "day", "hour", "quarter", "minute", "second"],
        ["week", "day"],
    ]
    for chain in chains:
        for coarse, fine in zip(chain, chain[1:]):
            check(
                by_name[coarse][0] <= by_name[fine][0],
                f"{label} {iso(seconds)}: the {coarse} start is after the {fine} start",
            )


def check_fixed_points(label: str, zones: dict[str, Zone]) -> None:
    # Hand-written instants. Santiago's 2025 spring-forward gap swallows local
    # midnight, so 2025-09-07 starts at 01:00 -03, which is 04:00Z. Amman's
    # 2021 fall-back repeats 00:00, so 2021-10-29 starts at its first 00:00
    # +03. India and Nepal keep +05:30 and +05:45 all year.
    expected = [
        ("America/Santiago", date(2025, 9, 7), "2025-09-07T04:00:00Z"),
        ("Asia/Amman", date(2021, 10, 29), "2021-10-28T21:00:00Z"),
        ("Asia/Kolkata", date(2018, 1, 1), "2017-12-31T18:30:00Z"),
        ("Asia/Kathmandu", date(2018, 1, 1), "2017-12-31T18:15:00Z"),
        ("America/Toronto", date(1919, 3, 31), "1919-03-31T04:30:00Z"),
        ("America/Toronto", date(1919, 10, 25), "1919-10-25T04:00:00Z"),
        ("America/Toronto", date(1919, 10, 26), "1919-10-26T05:00:00Z"),
        ("Africa/Monrovia", date(1970, 1, 1), "1970-01-01T00:44:30Z"),
        ("Africa/Monrovia", date(1972, 1, 6), "1972-01-06T00:44:30Z"),
        ("Africa/Monrovia", date(1972, 1, 7), "1972-01-07T00:44:30Z"),
    ]
    for key, day, instant in expected:
        got = zones[key].day_start(day)
        check(got == parse_iso(instant), f"{label} {key} dayStart({day}) is {iso(got)}, not {instant}")

    # Hand-written hour slots. Lord Howe moves by 30 minutes, so a day there is
    # not a whole number of hours. On 2025-10-05 it springs from 02:00 +10:30 to
    # 02:30 +11 at 15:30Z the day before. The day starts at 2025-10-04T13:30Z
    # and lasts 23.5 hours, so the hour after the gap starts at 15:30Z and the
    # last hour slot runs from 2025-10-05T12:30Z to the next day start at 13:00Z.
    # On 2025-04-06 it falls back from 02:00 +11 to 01:30 +10:30 at 15:00Z the
    # day before. That day starts at 2025-04-05T13:00Z and lasts 24.5 hours, so
    # 15:05Z and 15:35Z share the 15:00Z hour and the last hour slot runs from
    # 2025-04-06T13:00Z to 13:30Z. Santiago's gap day of 2025-09-07 starts at
    # 04:00Z, so its hours start on the UTC hour.
    hours = [
        ("Australia/Lord_Howe", "2025-10-04T15:40:00Z", "2025-10-04T15:30:00Z", "2025-10-04T16:30:00Z"),
        ("Australia/Lord_Howe", "2025-10-05T12:45:00Z", "2025-10-05T12:30:00Z", "2025-10-05T13:00:00Z"),
        ("Australia/Lord_Howe", "2025-04-05T15:05:00Z", "2025-04-05T15:00:00Z", "2025-04-05T16:00:00Z"),
        ("Australia/Lord_Howe", "2025-04-05T15:35:00Z", "2025-04-05T15:00:00Z", "2025-04-05T16:00:00Z"),
        ("Australia/Lord_Howe", "2025-04-06T13:10:00Z", "2025-04-06T13:00:00Z", "2025-04-06T13:30:00Z"),
        ("America/Santiago", "2025-09-07T04:00:00Z", "2025-09-07T04:00:00Z", "2025-09-07T05:00:00Z"),
        ("America/Santiago", "2025-09-07T12:00:00Z", "2025-09-07T12:00:00Z", "2025-09-07T13:00:00Z"),
        ("America/Toronto", "1919-03-31T05:10:00Z", "1919-03-31T04:30:00Z", "1919-03-31T05:30:00Z"),
        ("America/Toronto", "1919-10-26T04:20:00Z", "1919-10-26T04:00:00Z", "1919-10-26T05:00:00Z"),
        ("Africa/Monrovia", "1970-01-01T00:44:40Z", "1970-01-01T00:44:30Z", "1970-01-01T01:44:30Z"),
        ("Africa/Monrovia", "1972-01-07T00:50:00Z", "1972-01-07T00:44:30Z", "1972-01-07T01:44:30Z"),
    ]
    for key, instant, start, end in hours:
        got = slots(zones[key], parse_iso(instant))[INTERVALS.index("hour")]
        want = (parse_iso(start), parse_iso(end))
        check(got == want, f"{label} {key} hour of {instant} is {iso(got[0])}..{iso(got[1])}, not {start}..{end}")


def check_golden(label: str, oslo: Zone) -> None:
    with open(GOLDEN, encoding="utf-8") as handle:
        golden = json.load(handle)["zones"]["Europe/Oslo"]["2025-10-26"]
    expected = [(parse_iso(s["utc_start"]), parse_iso(s["utc_end"])) for s in golden]
    check(len(expected) == 25, f"the golden file has {len(expected)} Oslo slots on 2025-10-26")
    day = date(2025, 10, 26)
    start, stop = oslo.day_start(day), oslo.day_start(day + timedelta(days=1))
    got = []
    seconds = start
    while seconds < stop:
        hour_start, hour_end = slots(oslo, seconds)[3]
        got.append((hour_start, hour_end))
        seconds = hour_end
    check(got == expected, f"{label} Oslo 2025-10-26 hourly slots differ from {GOLDEN.name}")
    for slot_start, slot_end in expected:
        for seconds in (slot_start, slot_start + 1799, slot_end - 1):
            hour = slots(oslo, seconds)[3]
            check(hour == (slot_start, slot_end), f"{label} Oslo {iso(seconds)} is outside its golden hour")


# ---------------------------------------------------------------------------
# Output


def thin(rows: list[list[int]], anchors_ms: set[int], percent: int) -> list[list[int]]:
    """Keep every anchor row and an even percent of the other rows, in time order."""
    kept, index = [], 0
    for row in rows:
        if row[0] in anchors_ms:
            kept.append(row)
            continue
        if (index + 1) * percent // 100 > index * percent // 100:
            kept.append(row)
        index += 1
    return kept


def main() -> int:
    versions = {"pinned": pinned_version(), "system": system_version()}
    sources = {
        "pinned": {key: Zone(pinned_zone(key)) for key in ZONES},
        "system": {key: Zone(system_zone(key)) for key in ZONES},
    }
    for label, zones in sources.items():
        check_fixed_points(label, zones)
        if GOLDEN.exists():
            check_golden(label, zones["Europe/Oslo"])
        else:
            print(f"{label}: no {GOLDEN}, so the Oslo golden check is skipped")

    dropped: list[dict] = []
    rows_by_zone: dict[str, list[list[int]]] = {}
    anchor_seconds: dict[str, set[int]] = {}
    transition_counts: dict[str, int] = {}
    for key in ZONES:
        pinned, system = sources["pinned"][key], sources["system"][key]
        anchors_pinned, anchors_system = anchors(key, pinned), anchors(key, system)
        for only, side in ((set(anchors_pinned) - set(anchors_system), "pinned"),
                           (set(anchors_system) - set(anchors_pinned), "system")):
            for anchor in sorted(only):
                dropped.append({"zone": key, "kind": "transition", "only_in": side, "t": iso(anchor)})
        anchor_seconds[key] = set(anchors_pinned) & set(anchors_system)
        transition_counts[key] = len(set(anchors_pinned) | set(anchors_system))
        wanted = set()
        for zone, found in ((pinned, anchors_pinned), (system, anchors_system)):
            for anchor in found:
                wanted |= samples(zone, anchor)
        rows = []
        for seconds in sorted(wanted):
            row_pinned, row_system = slots(pinned, seconds), slots(system, seconds)
            check_row(f"pinned {key}", seconds, row_pinned)
            check_row(f"system {key}", seconds, row_system)
            if row_pinned != row_system:
                dropped.append({
                    "zone": key,
                    "kind": "sample",
                    "t": iso(seconds),
                    "pinned": [iso(start) for start, _ in row_pinned],
                    "system": [iso(start) for start, _ in row_system],
                })
                continue
            rows.append([seconds * 1000] + [start * 1000 for start, _ in row_pinned])
        rows_by_zone[key] = rows

    meta = {
        "kind": "slot starts per interval at sampled instants",
        "generator": "slot_starts.py (Python zoneinfo, json and the pinned tzdata package, no Fuse code)",
        "python": sys.version.split()[0],
        "tzdata": versions,
        "tzdata_policy": "a row is kept only when the pinned and system sources give the same starts",
        "rule": RULE,
        "interval_order": INTERVALS,
        "row": "[t_ms, " + ", ".join(f"start_{name}_ms" for name in INTERVALS) + "]",
        "window": [iso(int(WINDOW_START.timestamp())), iso(int(WINDOW_END.timestamp()) - 1)],
        "transition_cutoff": {key: iso(int(value.timestamp())) for key, value in TRANSITION_CUTOFF.items()},
        "fixed_offset_days": {key: [day.isoformat() for day in FIXED_DAYS] for key in sorted(FIXED_ZONES)},
        "historic_anchors": {key: [iso(int(m.timestamp())) for m in moments] for key, moments in HISTORIC_ANCHORS.items()},
        "samples": (
            "For each UTC-offset transition T, T plus each of " + str(OFFSET_MINUTES) + " minutes; "
            "dayStart of the local dates of T - 1 s and T and of the day after each, each minus 1 s, "
            "exactly and plus 1 s; and the first instant within an hour of T whose wall time is HH:45 "
            "in T's local hour. Fixed-offset zones use the dayStart of each fixed_offset_days entry as T."
        ),
        "transitions": transition_counts,
        "dropped": dropped,
        "cut": None,
        "conventions": "README.md",
    }
    payload = {"meta": meta, "zones": rows_by_zone}

    def encode() -> str:
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)

    text = encode()
    percent = 100
    while len(text.encode("utf-8")) + 1 > SIZE_LIMIT:
        percent -= 1
        payload["zones"] = {
            # Historic zones carry the rare cases, so they keep every row.
            key: rows if key in HISTORIC_ANCHORS else thin(rows, {s * 1000 for s in anchor_seconds[key]}, percent)
            for key, rows in rows_by_zone.items()
        }
        meta["cut"] = {
            "reason": f"the full sample set exceeds {SIZE_LIMIT} bytes",
            "selection": (
                f"Every row whose t is a transition instant T is kept. Of the other rows of a zone, "
                f"in time order and counted from 0, row i is kept when floor((i + 1) * {percent} / 100) "
                f"> floor(i * {percent} / 100). That keeps {percent} percent of them, spread evenly."
            ),
            "rows_before_cut": {key: len(rows) for key, rows in rows_by_zone.items()},
            "rows_after_cut": {key: len(rows) for key, rows in payload["zones"].items()},
        }
        text = encode()

    total_before = sum(len(rows) for rows in rows_by_zone.values())
    total_after = sum(len(rows) for rows in payload["zones"].values())
    if FAILURES:
        print(f"{len(FAILURES)} self-check failures, so {OUT.name} is left unchanged:", file=sys.stderr)
        for failure in FAILURES:
            print(f"  {failure}", file=sys.stderr)
        return 1
    staged = OUT.with_suffix(".json.tmp")
    staged.write_text(text + "\n", encoding="utf-8")
    staged.replace(OUT)

    print(f"wrote {OUT.name}: {len(text.encode('utf-8')) + 1} bytes, {total_after} of {total_before} rows")
    for key, rows in payload["zones"].items():
        print(f"  {key}: {len(rows)} of {len(rows_by_zone[key])} rows, {transition_counts[key]} anchors")
    print(f"dropped: {len(dropped)}")
    for item in dropped:
        print(f"  {item}")
    print("all self-checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
