/**
 * Loads the `@elmeragroup/fuse/temporal-polyfill` entry after setting the stage it meets, in that
 * order, by awaiting each step. A test file imports only this module, never the entry itself, so
 * no import sort can move the entry ahead of the stage. Each test file runs in its own process or
 * page, so the globals a stage changes stay in that file.
 */
import { hostTemporal, TEMPORAL_INSTALL_MARKER } from "../src/temporal/install-marker";

/** The globals around the entry's evaluation. */
type EntryStage = {
  /** The engine's own Temporal, captured before the stage changed anything. */
  readonly native: typeof Temporal | undefined;
  /** The engine's own `Intl.DateTimeFormat`, captured before the stage changed anything. */
  readonly nativeDateTimeFormat: typeof Intl.DateTimeFormat;
  /** The Temporal on `globalThis` just before the entry ran. */
  readonly before: typeof Temporal | undefined;
  /** The `Intl.DateTimeFormat` just before the entry ran. */
  readonly dateTimeFormatBefore: typeof Intl.DateTimeFormat;
  /** Whether the install marker was already set before the entry ran. */
  readonly markedBefore: boolean;
};

/**
 * Where the entry runs: in the engine as it is, without its Temporal, with `globalThis.Temporal`
 * set to `undefined` rather than removed, or after a host's own implementation.
 */
type EntryHost = "native" | "without-temporal" | "undefined-temporal" | "host-polyfill";

/**
 * Sets the stage, then evaluates the entry.
 *
 * @param host - What is on `globalThis` when the entry runs. `"host-polyfill"` installs
 *   `temporal-polyfill/full/global`, which reads non-ISO calendars and installs its own
 *   `Intl.DateTimeFormat`, in place of the engine's Temporal.
 * @returns The globals captured around the entry.
 */
export async function loadTemporalPolyfillEntry(host: EntryHost): Promise<EntryStage> {
  const native = hostTemporal();
  const nativeDateTimeFormat = Intl.DateTimeFormat;
  if (host === "undefined-temporal") {
    Reflect.set(globalThis, "Temporal", undefined);
  } else if (host !== "native") {
    Reflect.deleteProperty(globalThis, "Temporal");
  }
  if (host === "host-polyfill") {
    // That entry keeps a Temporal already on `globalThis`, which is why the engine's goes first.
    await import("temporal-polyfill/full/global");
  }
  const before = hostTemporal();
  const dateTimeFormatBefore = Intl.DateTimeFormat;
  const markedBefore = TEMPORAL_INSTALL_MARKER in globalThis;
  await import("../src/temporal-polyfill");
  return { native, nativeDateTimeFormat, before, dateTimeFormatBefore, markedBefore };
}
