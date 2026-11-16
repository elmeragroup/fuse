// What a tour remembers per user, and the pure helpers that parse, merge and carry it in a cookie.
// No React and no directive: a Server Component imports this module to read the tour cookie and
// hand the records to `Tour.Provider` as `initialRecords`.
//
// Records are a plain object keyed by tour id, so storage writes them as JSON. Every helper builds
// objects through `Object.fromEntries`, which defines own properties, so a stored tour id such as
// `"__proto__"` stays a key and never reaches a prototype.

/** How a tour ended for good: the user finished it or turned it down. */
export type TourStatus = "completed" | "dismissed";

/** What the tour remembers about one tour for one user. */
export type TourRecord = {
  /** How the tour ended for good, when it has. */
  readonly status?: TourStatus;
  /** The definition version the record's progress belongs to. */
  readonly v: number;
  /** The id of the last step shown, where an auto-started run resumes. */
  readonly step?: string;
  /** The ids of the steps the user finished as checklist tasks. */
  readonly done?: readonly string[];
  /** When the record last changed, in milliseconds since the epoch. */
  readonly at: number;
};

/** Every tour's record, keyed by tour id. */
export type TourRecords = { readonly [tourId: string]: TourRecord };

/** The records of no tour. */
export const NO_TOUR_RECORDS: TourRecords = Object.freeze({});

// This is the parse boundary: storage and cookies hand back untyped JSON, and these guards are the
// only runtime type checks over it.

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over stored JSON
function isStatus(value: unknown): value is TourStatus {
  return value === "completed" || value === "dismissed";
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over stored JSON
function isFiniteNumber(value: unknown): value is number {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parse boundary over stored JSON
  return typeof value === "number" && Number.isFinite(value);
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over stored JSON
function isString(value: unknown): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parse boundary over stored JSON
  return typeof value === "string";
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over stored JSON
function isPlainObject(value: unknown): value is object {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parse boundary over stored JSON
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type MutableTourRecord = { -readonly [K in keyof TourRecord]: TourRecord[K] };

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over stored JSON
function parseRecord(value: unknown): TourRecord | null {
  if (!isPlainObject(value) || !("v" in value && "at" in value)) {
    return null;
  }
  const { v, at } = value;
  if (!isFiniteNumber(v) || !isFiniteNumber(at)) {
    return null;
  }
  const record: MutableTourRecord = { v, at };
  if ("status" in value && value.status !== undefined) {
    if (!isStatus(value.status)) {
      return null;
    }
    record.status = value.status;
  }
  if ("step" in value && value.step !== undefined) {
    if (!isString(value.step)) {
      return null;
    }
    record.step = value.step;
  }
  if ("done" in value && value.done !== undefined) {
    if (!Array.isArray(value.done) || !value.done.every(isString)) {
      return null;
    }
    record.done = value.done.filter(isString);
  }
  return record;
}

/**
 * Tour records parsed from untrusted data, such as a storage value written by an older client. Each
 * entry that is not a record is dropped on its own, so one bad entry never loses the others.
 *
 * @param value - The data to parse.
 * @returns The records; empty when `value` is not an object.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over stored JSON
export function parseTourRecords(value: unknown): TourRecords {
  if (!isPlainObject(value)) {
    return NO_TOUR_RECORDS;
  }
  const entries: [string, TourRecord][] = [];
  for (const [tourId, candidate] of Object.entries(value)) {
    const record = parseRecord(candidate);
    if (record !== null) {
      entries.push([tourId, record]);
    }
  }
  return Object.fromEntries(entries);
}

/**
 * Tour records parsed from JSON text.
 *
 * @param text - The JSON text, or `null` when nothing is stored.
 * @returns The records; empty when the text is missing or is not JSON.
 */
export function parseTourRecordsJson(text: string | null | undefined): TourRecords {
  if (text === null || text === undefined || text === "") {
    return NO_TOUR_RECORDS;
  }
  try {
    return parseTourRecords(JSON.parse(text));
  } catch {
    return NO_TOUR_RECORDS;
  }
}

function winner(current: TourRecord, incoming: TourRecord): TourRecord {
  if (current.status !== undefined && incoming.status === undefined) {
    return current;
  }
  if (incoming.status !== undefined && current.status === undefined) {
    return incoming;
  }
  return incoming.at > current.at ? incoming : current;
}

/**
 * Two record sets merged tour by tour. A record with a status beats one without, whatever their ages,
 * so a device that saw a tour half way never brings back a tour the user finished elsewhere. Between
 * two records that both have a status, or both lack one, the newer `at` wins, and `current` wins a
 * tie.
 *
 * @param current - The records held now.
 * @param incoming - The records to merge in.
 * @returns The merged records. It is `current` itself when no incoming record wins, and it keeps
 *   every record that did not change by reference.
 */
export function mergeTourRecords(current: TourRecords, incoming: TourRecords): TourRecords {
  let changed = false;
  const merged = new Map(Object.entries(current));
  for (const [tourId, record] of Object.entries(incoming)) {
    const held = merged.get(tourId);
    const next = held === undefined ? record : winner(held, record);
    if (next !== held) {
      merged.set(tourId, next);
      changed = true;
    }
  }
  return changed ? Object.fromEntries(merged) : current;
}

/** The cookie name the tour helpers use by default. */
export const TOUR_COOKIE_NAME = "fuse-tours";

/**
 * The tour cookie's value for `records`: the finished tours only, as URI-encoded JSON. A tour in
 * progress stays out, so the cookie stays small. Write it from a Server Action or route handler
 * under `TOUR_COOKIE_NAME`.
 *
 * @param records - The records to carry.
 * @returns The cookie value.
 */
export function serializeTourCookie(records: TourRecords): string {
  const finished: [string, TourRecord][] = [];
  for (const [tourId, record] of Object.entries(records)) {
    if (record.status !== undefined) {
      finished.push([tourId, { status: record.status, v: record.v, at: record.at }]);
    }
  }
  return encodeURIComponent(JSON.stringify(Object.fromEntries(finished)));
}

/**
 * The records in a tour cookie's value, for `Tour.Provider`'s `initialRecords`. It reads a value as
 * `serializeTourCookie` wrote it, and also one a cookie library already decoded.
 *
 * @param value - The cookie's value, or `undefined` when the request has no tour cookie.
 * @returns The records; empty when the value is missing or unreadable.
 */
export function parseTourCookie(value: string | null | undefined): TourRecords {
  if (value === null || value === undefined || value === "") {
    return NO_TOUR_RECORDS;
  }
  // JSON opens with `{`, which `serializeTourCookie` encodes as `%7B`, so a leading brace means a
  // cookie library already decoded the value.
  if (value.startsWith("{")) {
    return parseTourRecordsJson(value);
  }
  try {
    return parseTourRecordsJson(decodeURIComponent(value));
  } catch {
    return NO_TOUR_RECORDS;
  }
}
