/**
 * Unit under test: the `@elmeragroup/fuse/temporal-polyfill` entry after a host installed its own
 * Temporal implementation. Oracle: the entry's contract (install only where no Temporal is there
 * when it runs, set the marker either way) and the full implementation's own behaviour, written out
 * by hand. The host's implementation is `temporal-polyfill/full/global`, which reads non-ISO
 * calendars and installs its own `Intl.DateTimeFormat`; `test/temporal-polyfill-stage.ts`
 * installs it in place of the runtime's own Temporal, then loads the entry.
 */
import { describe, expect, it } from "vitest";

import { loadTemporalPolyfillEntry } from "../test/temporal-polyfill-stage";
import { TEMPORAL_INSTALL_MARKER } from "./temporal/install-marker";

const stage = await loadTemporalPolyfillEntry("host-polyfill");

describe("temporal-polyfill after a host installed another implementation", () => {
  it("runs the entry after the host's implementation replaced the runtime's own", () => {
    expect(stage.markedBefore).toBe(false);
    expect(stage.before).toBeDefined();
    expect(stage.before).not.toBe(stage.native);
    expect(stage.dateTimeFormatBefore).not.toBe(stage.nativeDateTimeFormat);
  });

  it("keeps the host's Temporal and Intl.DateTimeFormat, and sets the marker", () => {
    expect(globalThis.Temporal).toBe(stage.before);
    expect(Intl.DateTimeFormat).toBe(stage.dateTimeFormatBefore);
    expect(TEMPORAL_INSTALL_MARKER in globalThis).toBe(true);
  });

  it("still formats the host's values and reads its calendars", () => {
    const date = stage.before?.PlainDate.from("2026-03-15");
    expect(date?.toLocaleString("en-US", { timeZone: "UTC" })).toBe("3/15/2026");
    expect(globalThis.Temporal.PlainDate.from("2026-03-15[u-ca=hebrew]").toString()).toBe(
      "2026-03-15[u-ca=hebrew]"
    );
  });
});
