import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

/**
 * Unit under test: the `temporal()` accessor. Oracle: the host-setup contract in the date-tier
 * plan: a clear TypeError naming the subpath without Temporal, and one development warning when
 * the subpath's marker is missing. The warning is spent once per module instance, and this file
 * loads one, so a single test owns it.
 */
import "../temporal-polyfill";
import { TEMPORAL_INSTALL_MARKER } from "./install-marker";
import { temporal } from "./temporal";

describe("temporal()", () => {
  const installed = globalThis.Temporal;
  let warn: MockInstance<Console["warn"]>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.Temporal = installed;
    Reflect.set(globalThis, TEMPORAL_INSTALL_MARKER, true);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reads Temporal when called: it throws a TypeError naming the subpath while none is installed", () => {
    expect(temporal().PlainDate.from("2026-03-15").add({ days: 17 }).toString()).toBe("2026-04-01");
    Reflect.deleteProperty(globalThis, "Temporal");
    expect(() => temporal()).toThrow(TypeError);
    expect(() => temporal()).toThrow('Import "@elmeragroup/fuse/temporal-polyfill" once');
    globalThis.Temporal = installed;
    expect(temporal().PlainDate.from("2026-03-15").toString()).toBe("2026-03-15");
  });

  it("throws the same TypeError when Temporal is set to undefined rather than removed", () => {
    Reflect.set(globalThis, "Temporal", undefined);
    expect(() => temporal()).toThrow('Import "@elmeragroup/fuse/temporal-polyfill" once');
  });

  it("stays silent while the subpath's marker is set", () => {
    temporal();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once in development, and never in production, when the marker is missing", () => {
    Reflect.deleteProperty(globalThis, TEMPORAL_INSTALL_MARKER);
    vi.stubEnv("NODE_ENV", "production");
    temporal();
    expect(warn).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    temporal();
    temporal();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"@elmeragroup/fuse/temporal-polyfill" was not imported');
  });
});
