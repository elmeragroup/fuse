/**
 * The x-domain judges. Each compares the slots Fuse's time axis lists with the zoneinfo slot lists
 * in `format/fixtures/slots.json`, for every day, month and year the file holds in Oslo, Stockholm
 * and Helsinki. Rows on the slot starts must list the same slots, and a period from the first
 * start to the next day, month or year must list them too.
 */
import slots from "../../format/fixtures/slots.json" with { type: "json" };
import type { Interval } from "../../format/time-format";
import { nextSlotStart } from "../../format/time-format";
import { placeTimeRows } from "../x-domain";

/** One comparison. */
export type SlotJudgement = { readonly name: string; readonly actual: unknown; readonly expected: unknown };

const ZONES = ["Europe/Oslo", "Europe/Stockholm", "Europe/Helsinki"] as const;

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
  ];
}
