// Unit under test: the tour record helpers. Oracles: the plan's merge rule (a status beats no
// status at any age, otherwise the newer `at` wins, and a done checklist step of the same version
// is never lost) restated per tour in the assertions, and the
// cookie's contract that it carries every finished record's status, version and time.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { mergeTourRecords, parseTourCookie, parseTourRecords, serializeTourCookie } from "./tour-records";
import type { TourRecord, TourRecords } from "./tour-records";

const tourId = fc.constantFrom("welcome", "billing", "invoices", "__proto__", "a.b");

const record: fc.Arbitrary<TourRecord> = fc.record(
  {
    status: fc.constantFrom("completed" as const, "dismissed" as const),
    v: fc.integer({ min: 1, max: 3 }),
    step: fc.constantFrom("intro", "usage", "price"),
    done: fc.array(fc.constantFrom("intro", "usage", "price"), { maxLength: 3 }),
    at: fc.integer({ min: 0, max: 1_000_000 }),
  },
  { requiredKeys: ["v", "at"] }
);

const records: fc.Arbitrary<TourRecords> = fc
  .array(fc.tuple(tourId, record), { maxLength: 6 })
  .map((entries) => Object.fromEntries(entries));

describe("mergeTourRecords", () => {
  it("never loses a finished status, whichever side holds it and whatever its age", () => {
    fc.assert(
      fc.property(records, records, (current, incoming) => {
        const merged = mergeTourRecords(current, incoming);
        for (const id of new Set([...Object.keys(current), ...Object.keys(incoming)])) {
          const finished = current[id]?.status !== undefined || incoming[id]?.status !== undefined;
          expect(merged[id]?.status !== undefined).toBe(finished);
        }
      })
    );
  });

  it("takes the newer record between two that agree on having a status", () => {
    fc.assert(
      fc.property(records, records, (current, incoming) => {
        const merged = mergeTourRecords(current, incoming);
        for (const [id, mine] of Object.entries(current)) {
          const theirs = incoming[id];
          if (theirs !== undefined && (mine.status === undefined) === (theirs.status === undefined)) {
            const { done: _done, ...won } = theirs.at > mine.at ? theirs : mine;
            expect(merged[id]).toMatchObject(won);
          }
        }
      })
    );
  });

  it("keeps every checklist step either record of the same version marked done", () => {
    fc.assert(
      fc.property(records, records, (current, incoming) => {
        const merged = mergeTourRecords(current, incoming);
        for (const [id, mine] of Object.entries(current)) {
          const theirs = incoming[id];
          const kept = merged[id];
          if (theirs !== undefined && theirs.v === mine.v && kept !== undefined) {
            for (const stepId of [...(mine.done ?? []), ...(theirs.done ?? [])]) {
              expect(kept.done).toContain(stepId);
            }
          }
        }
      })
    );
  });

  it("is idempotent, and returns the held records themselves when nothing incoming wins", () => {
    fc.assert(
      fc.property(records, records, (current, incoming) => {
        const once = mergeTourRecords(current, incoming);
        expect(mergeTourRecords(once, incoming)).toBe(once);
        expect(mergeTourRecords(current, current)).toBe(current);
        for (const [id, held] of Object.entries(current)) {
          if (incoming[id] === undefined) {
            expect(once[id]).toBe(held);
          }
        }
      })
    );
  });
});

describe("the tour cookie", () => {
  it("carries every finished record's status, version and time, and leaves unfinished tours out", () => {
    fc.assert(
      fc.property(records, (held) => {
        const value = serializeTourCookie(held);
        for (const parsed of [parseTourCookie(value), parseTourCookie(decodeURIComponent(value))]) {
          for (const [id, original] of Object.entries(held)) {
            expect(Object.hasOwn(parsed, id)).toBe(original.status !== undefined);
            if (original.status !== undefined) {
              expect(parsed[id]).toEqual({ status: original.status, v: original.v, at: original.at });
            }
          }
        }
      })
    );
  });

  it("answers no records for a missing or unreadable value", () => {
    expect(parseTourCookie(undefined)).toEqual({});
    expect(parseTourCookie("%E0%A4%A")).toEqual({});
    expect(parseTourCookie("{not json")).toEqual({});
  });
});

describe("parseTourRecords", () => {
  it("drops each malformed entry on its own and keeps the rest", () => {
    const parsed = parseTourRecords({
      welcome: { status: "completed", v: 1, at: 5 },
      billing: { status: "maybe", v: 1, at: 5 },
      invoices: { v: "1", at: 5 },
      prices: { v: 2, at: 9, step: "usage", done: ["intro", 3] },
      plans: { v: 2, at: 9, step: "usage", done: ["intro"] },
    });
    expect(parsed).toEqual({
      welcome: { status: "completed", v: 1, at: 5 },
      plans: { v: 2, at: 9, step: "usage", done: ["intro"] },
    });
  });

  it("keeps a stored `__proto__` tour id as a key", () => {
    const parsed = parseTourRecords(JSON.parse('{"__proto__":{"v":1,"at":1,"status":"dismissed"}}'));
    expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });
});
