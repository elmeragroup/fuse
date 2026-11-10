import { describe, expect, it } from "vitest";

/**
 * Unit under test: the `@elmeragroup/fuse/temporal-polyfill` entry in an engine without Temporal.
 * Every engine the browser projects run ships Temporal natively, so nothing else exercises the
 * polyfill in a page: `test/temporal-polyfill-stage.ts` removes the engine's Temporal, then loads
 * the entry. Oracle: ISO 8601 date arithmetic and the entry's contract (install where Temporal is
 * missing, set the marker), written out by hand.
 */
import { getOrThrow } from "@elmeragroup/color/result";

import { loadTemporalPolyfillEntry } from "../test/temporal-polyfill-stage";
import { parseTemporalProp } from "./components/calendar/calendar-input";
import { checkBounds } from "./temporal/bounds";
import { TEMPORAL_INSTALL_MARKER } from "./temporal/install-marker";
import { parseTemporal } from "./temporal/temporal-value";

const stage = await loadTemporalPolyfillEntry("without-temporal");

describe("temporal-polyfill in an engine without Temporal", () => {
  it("installs Temporal and sets the install marker", () => {
    expect(stage.markedBefore).toBe(false);
    expect(stage.before).toBeUndefined();
    expect(globalThis.Temporal).not.toBe(stage.native);
    expect(globalThis.Temporal.PlainDate.from("2026-02-28").add({ days: 1 }).toString()).toBe("2026-03-01");
    expect(TEMPORAL_INSTALL_MARKER in globalThis).toBe(true);
  });

  it("converts and compares through the installed Temporal", () => {
    const parsed = getOrThrow(parseTemporal("2026-02-28T22:30"));
    expect(parsed.add({ hours: 2 }).toString()).toBe("2026-03-01T00:30:00");
    const max = getOrThrow(parseTemporal("2026-03-01"));
    expect(checkBounds(parsed, { min: undefined, max })).toBe("within");
  });

  it("re-brands the engine's own Temporal values as the installed implementation's", () => {
    const native = stage.native;
    if (native === undefined) {
      throw new Error("This engine ships no native Temporal to re-brand.");
    }
    const foreign = native.ZonedDateTime.from("2026-03-15T09:30+01:00[Europe/Oslo]");
    expect(foreign instanceof globalThis.Temporal.ZonedDateTime).toBe(false);
    const parsed = parseTemporalProp(foreign, "DateInput.Root", "value");
    expect(parsed instanceof globalThis.Temporal.ZonedDateTime).toBe(true);
    expect(parsed.toString()).toBe("2026-03-15T09:30:00+01:00[Europe/Oslo]");
  });

  it("reads one calendar rule under the polyfill: ISO and Gregorian in, any other refused", () => {
    expect(getOrThrow(parseTemporal("2026-03-15[u-ca=gregory]")).toString()).toBe("2026-03-15");
    expect(parseTemporal("2026-03-15[u-ca=hebrew]")._tag).toBe("err");
    expect(parseTemporal("2026-03-15[u-ca=japanese]")._tag).toBe("err");
  });
});
