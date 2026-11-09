/**
 * Unit under test: the `@elmeragroup/fuse/temporal-polyfill` entry where a host removed Temporal
 * by setting `globalThis.Temporal` to `undefined`, which leaves the property in place. Oracle: the
 * entry's contract (install where no Temporal is there) and ISO 8601 date arithmetic, written out
 * by hand.
 */
import { describe, expect, it } from "vitest";

import { loadTemporalPolyfillEntry } from "../test/temporal-polyfill-stage";
import { TEMPORAL_INSTALL_MARKER } from "./temporal/install-marker";

const stage = await loadTemporalPolyfillEntry("undefined-temporal");

describe("temporal-polyfill where globalThis.Temporal is undefined", () => {
  it("installs Temporal", () => {
    expect(stage.before).toBeUndefined();
    expect(stage.markedBefore).toBe(false);
    expect(TEMPORAL_INSTALL_MARKER in globalThis).toBe(true);
    expect(globalThis.Temporal.PlainDate.from("2026-02-28").add({ days: 1 }).toString()).toBe("2026-03-01");
  });
});
