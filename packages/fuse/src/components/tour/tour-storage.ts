// Where tour records live. `TourStorage` is the port the Provider's session reads and writes; the
// adapters below are localStorage, memory, a consumer's backend, and a cache in front of a backend.
// The module has no directive and touches `window` only inside adapter methods, so a Server
// Component may import it.
//
// A consumer writes their own adapter, so every method may throw or reject. The session calls each
// one inside a guard, falls back to memory and reports `storage:error`, so a failing adapter never
// reaches the host.

import { mergeTourRecords, NO_TOUR_RECORDS, parseTourRecords, parseTourRecordsJson } from "./tour-records";
import type { TourRecords } from "./tour-records";
import type { TourRecordChange } from "./tour-session";

/**
 * Where a `Tour.Provider` keeps tour records. Implement it to keep records on a backend, or use
 * `remoteTourStorage`.
 */
export type TourStorage = {
  /** Reads every tour's record. It may throw or reject; the Provider then keeps records in memory. */
  readonly read: () => TourRecords | Promise<TourRecords>;
  /**
   * Writes one tour's changed record. `records` holds every record the Provider has, the change
   * included. It may throw or reject; the Provider then keeps records in memory.
   */
  readonly write: (records: TourRecords, change: TourRecordChange) => void | Promise<void>;
  /**
   * Calls `listener` with the records when another tab or device changes them, and returns a
   * function that unsubscribes it.
   */
  readonly subscribe?: (listener: (records: TourRecords) => void) => () => void;
};

/**
 * Storage that keeps records in memory for the life of the page, for demos and tests.
 *
 * @param seed - The records it starts with.
 * @returns The storage.
 */
export function memoryTourStorage(seed: TourRecords = NO_TOUR_RECORDS): TourStorage {
  let records = seed;
  return {
    read: () => records,
    write: (next) => {
      records = next;
    },
  };
}

/** The localStorage key `localTourStorage` uses by default. */
export const TOUR_STORAGE_KEY = "fuse-tours";

/** Options for `localTourStorage`. */
export type LocalTourStorageOptions = {
  /** The localStorage key. */
  readonly key?: string;
};

/**
 * Storage in the browser's localStorage under one key, and the Provider's default. A write merges the
 * changed record into what the key holds, so two tabs never drop each other's tours, and tabs follow
 * each other's writes through the `storage` event.
 *
 * @param options - The key.
 * @returns The storage.
 */
export function localTourStorage({ key = TOUR_STORAGE_KEY }: LocalTourStorageOptions = {}): TourStorage {
  const stored = (): TourRecords => parseTourRecordsJson(window.localStorage.getItem(key));
  return {
    read: stored,
    write: (_records, change) => {
      const next = mergeTourRecords(stored(), Object.fromEntries([[change.tourId, change.record]]));
      window.localStorage.setItem(key, JSON.stringify(next));
    },
    subscribe(listener) {
      const onStorage = (event: StorageEvent): void => {
        if (event.key === key) {
          listener(parseTourRecordsJson(event.newValue));
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

/** Options for `remoteTourStorage`. */
export type RemoteTourStorageOptions = {
  /**
   * Loads every tour's record from the backend, such as through `fetch` or a Server Action. The
   * storage parses the answer and drops each entry that is not a record.
   */
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- the backend's answer is untyped JSON, which `parseTourRecords` parses
  readonly load: () => Promise<unknown>;
  /** Saves one tour's changed record to the backend. */
  readonly save: (change: TourRecordChange, records: TourRecords) => Promise<void>;
};

/**
 * Storage on the consumer's backend. Put `layeredTourStorage` in front of it, so a page does not
 * wait for the network to know which tours are finished.
 *
 * @param options - How to load and save.
 * @returns The storage.
 */
export function remoteTourStorage({ load, save }: RemoteTourStorageOptions): TourStorage {
  return {
    read: async () => parseTourRecords(await load()),
    write: (records, change) => save(change, records),
  };
}

/** Options for `layeredTourStorage`. */
export type LayeredTourStorageOptions = {
  /** How long a read waits for the remote before it answers with the cache, in milliseconds. */
  readonly waitMs?: number;
};

/** How long `layeredTourStorage` waits for its remote by default, in milliseconds. */
export const DEFAULT_LAYERED_WAIT_MS = 1200;

/**
 * A cache, such as `localTourStorage()`, in front of a remote, such as `remoteTourStorage`. A read
 * answers with the cache merged with the remote when the remote answers within `waitMs`, so a tour
 * the user finished on another device does not show. A slower or failing remote leaves the cache's
 * answer, and a late remote answer reaches subscribers and the cache. A write goes to the cache,
 * then the remote, and a failed remote save leaves the cache's copy.
 *
 * @param cache - The fast storage.
 * @param remote - The durable storage.
 * @param options - How long a read waits for the remote. Defaults to 1,200 milliseconds.
 * @returns The storage.
 */
export function layeredTourStorage(
  cache: TourStorage,
  remote: TourStorage,
  { waitMs = DEFAULT_LAYERED_WAIT_MS }: LayeredTourStorageOptions = {}
): TourStorage {
  const listeners = new Set<(records: TourRecords) => void>();

  // Every cache read-modify-write and every cache write runs in turn on this chain, so a late remote
  // answer's fill never interleaves with a write the session made meanwhile.
  let cacheTurn: Promise<unknown> = Promise.resolve();
  const onCache = <T>(operation: () => T | Promise<T>): Promise<T> => {
    const run = cacheTurn.then(operation);
    cacheTurn = run.catch(() => undefined);
    return run;
  };

  // Merges the remote's answer into what the cache holds now, not into the snapshot taken before the
  // remote call, and writes only the tours the remote improved.
  const fillCache = (far: TourRecords): Promise<TourRecords> =>
    onCache(async () => {
      const latest = await cache.read();
      const merged = mergeTourRecords(latest, far);
      for (const [tourId, record] of Object.entries(merged)) {
        if (latest[tourId] !== record) {
          await cache.write(merged, { tourId, record });
        }
      }
      return merged;
    });

  return {
    async read() {
      const local = await onCache(() => cache.read());
      let answered = false;
      const late = Promise.resolve()
        .then(() => remote.read())
        .then(async (far) => {
          const merged = await fillCache(far).catch(() => mergeTourRecords(local, far));
          if (answered) {
            for (const listener of listeners) {
              listener(merged);
            }
          }
          return merged;
        });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<TourRecords>((resolve) => {
        timer = setTimeout(() => resolve(local), waitMs);
      });
      try {
        return await Promise.race([late, timeout]);
      } catch {
        return local;
      } finally {
        answered = true;
        clearTimeout(timer);
        late.catch(() => undefined);
      }
    },
    async write(records, change) {
      await onCache(() => cache.write(records, change));
      // The cache holds the change now. A failed remote save leaves it saved on this device, as a
      // failed remote read leaves the cache's answer. A rejection here would make the session give
      // up the cache as well, and keep the rest of the run's progress in memory only.
      try {
        await remote.write(records, change);
      } catch {
        // The cache's copy stands.
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      const unsubscribeCache = cache.subscribe?.(listener);
      return () => {
        listeners.delete(listener);
        unsubscribeCache?.();
      };
    },
  };
}
