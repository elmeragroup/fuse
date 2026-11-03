/**
 * The x-domain judges. Each compares the slots Fuse's time axis lists with the zoneinfo slot lists
 * in `format/fixtures/slots.json`, for every day, month and year the file holds in Oslo, Stockholm
 * and Helsinki. Rows on the slot starts must list the same slots, and a period from the first
 * start to the next day, month or year must list them too. The coarse judges group one list's slots
 * by the slots of a coarser list, which CONTRACT section 8.8 counts by instants in the zone.
 */
import { ZONES } from "../../format/fixtures/judgement";
import type { Judgement } from "../../format/fixtures/judgement";
import slots from "../../format/fixtures/slots.json" with { type: "json" };
import type { Interval } from "../../format/time-format";
import { nextSlotStart } from "../../format/time-format";
import { coarseSlots } from "../coarse-slots";
import { placeTimeRows } from "../x-domain";

/** One comparison of slot starts or slot indexes. */
type SlotJudgement = Judgement<number>;

type Lists = {
  readonly [zone: string]: { readonly [key: string]: { readonly utc_start: readonly string[] } };
};

function judge(interval: Interval, period: Interval, lists: Lists): SlotJudgement[] {
  return ZONES.flatMap((zone) =>
    Object.entries(lists[zone] ?? {}).flatMap(([key, list]) => {
      const expected = list.utc_start.map((start) => Date.parse(start));
      const first = expected[0] ?? 0;
      const fromRows = placeTimeRows(
        expected.map((start) => new Date(start)),
        { interval, timeZone: zone }
      ).domain;
      const end = nextSlotStart(first, period, zone);
      const fromPeriod = placeTimeRows([], { interval, timeZone: zone, period: [first, end] }).domain;
      return [
        {
          name: `${interval} ${zone} ${key} from rows`,
          actual: fromRows.kind === "time" ? fromRows.starts : [],
          expected,
        },
        {
          name: `${interval} ${zone} ${key} from a period`,
          actual: fromPeriod.kind === "time" ? fromPeriod.starts : [],
          expected,
        },
      ];
    })
  );
}

/**
 * For each fine start, the index of the first fine start of the coarse slot whose start it follows:
 * the coarse slot holds every fine start from its own start up to the next coarse start.
 */
function groupedBy(fine: readonly number[], coarse: readonly number[]): number[] {
  return fine.map((start) => {
    const owner = coarse.findLast((coarseStart) => coarseStart <= start) ?? start;
    return fine.findIndex((candidate) => candidate >= owner);
  });
}

/** Quarters grouped into hours, and hours into days, for every day both lists hold. */
function coarseJudgements(): SlotJudgement[] {
  return ZONES.flatMap((zone) => {
    const byZone = (lists: Lists) => lists[zone] ?? {};
    const quarters = byZone(slots["quarter-hour"]);
    const hours = byZone(slots.hour);
    const parse = (list: readonly string[]) => list.map((start) => Date.parse(start));
    const perDay = Object.entries(hours).flatMap(([day, hourList]) => {
      const fine = parse(quarters[day]?.utc_start ?? []);
      const coarse = parse(hourList.utc_start);
      return [
        {
          name: `quarter-hour in hour ${zone} ${day}`,
          actual: coarseSlots(fine, "hour", zone).first,
          expected: groupedBy(fine, coarse),
        },
      ];
    });
    // The fall-back and spring-forward days each sit between two days of 24 hours.
    const spans = [
      ["2025-10-25", "2025-10-26", "2025-10-27"],
      ["2026-03-29", "2026-03-30"],
    ].map((days) => {
      const lists = days.map((day) => parse(hours[day]?.utc_start ?? []));
      return {
        name: `hour in day ${zone} ${days.join(" ")}`,
        actual: coarseSlots(lists.flat(), "day", zone).first,
        expected: groupedBy(
          lists.flat(),
          lists.map((list) => list[0] ?? 0)
        ),
      };
    });
    return [...perDay, ...spans];
  });
}

/**
 * Every x-domain judgement.
 *
 * @returns One judgement per list and source.
 */
export function slotJudgements(): SlotJudgement[] {
  return [
    ...judge("hour", "day", slots.hour),
    ...judge("quarter-hour", "day", slots["quarter-hour"]),
    ...judge("day", "month", slots.day),
    ...judge("month", "year", slots.month),
    ...coarseJudgements(),
  ];
}
