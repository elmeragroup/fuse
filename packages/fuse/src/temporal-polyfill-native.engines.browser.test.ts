/**
 * Unit under test: the `@elmeragroup/fuse/temporal-polyfill` entry in an engine with Temporal.
 * Oracle: the entry's contract: an engine's own Temporal and `Intl.DateTimeFormat` stay in place,
 * and the marker is set either way. A separate file from the install case, since an entry loads
 * once per frame.
 */
import { describe, expect, it } from "vitest";

import { loadTemporalPolyfillEntry } from "../test/temporal-polyfill-stage";
import { TEMPORAL_INSTALL_MARKER } from "./temporal/install-marker";

const stage = await loadTemporalPolyfillEntry("native");

describe("temporal-polyfill in an engine with Temporal", () => {
  it("keeps the engine's Temporal and Intl.DateTimeFormat, and sets the marker", () => {
    expect(stage.markedBefore).toBe(false);
    expect(stage.native).toBeDefined();
    expect(globalThis.Temporal).toBe(stage.native);
    expect(Intl.DateTimeFormat).toBe(stage.nativeDateTimeFormat);
    expect(TEMPORAL_INSTALL_MARKER in globalThis).toBe(true);
  });
});
