import type { ColorSchemePlatform } from "./color-scheme-platform";
import { disableColorSchemeTransitions } from "./disable-transition";
import type { TransitionHost } from "./disable-transition";

const SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** The `MediaQueryList` members the adapter touches; Safari < 14 has only the legacy pair. */
type ColorSchemeMediaQuery = {
  /** Whether the query matches. */
  readonly matches: boolean;
  /** The modern change listener. */
  addEventListener?(type: "change", listener: () => void): void;
  /** Removes a modern change listener. */
  removeEventListener?(type: "change", listener: () => void): void;
  /** The legacy change listener. */
  addListener?(listener: () => void): void;
  /** Removes a legacy change listener. */
  removeListener?(listener: () => void): void;
};

/** The `StorageEvent` fields the adapter reads. */
type ColorSchemeStorageEvent = {
  /** The changed key, or `null` for a whole-area clear. */
  readonly key: string | null;
  /** The new value, or `null` for a removal or clear. */
  readonly newValue: string | null;
  /** The area that changed, compared by identity with `localStorage`. */
  readonly storageArea: unknown;
};

/** The root the adapter reads and writes; the transition members come from `TransitionHost`. */
type ColorSchemeHostDocument = {
  /** The root whose `data-theme` the adapter reads and writes. */
  readonly documentElement: Pick<Element, "getAttribute" | "setAttribute">;
};

/**
 * The window subset the browser adapter touches: the transition host plus the storage and
 * media members. `globalThis` satisfies it structurally; the in-memory test host implements
 * it to model modern, legacy, missing and throwing platforms. The storage and media members
 * are optional because a server, a webview or a sandbox may lack them, and the
 * `localStorage` getter itself may throw.
 */
export type ColorSchemeHost = TransitionHost & {
  /** The document whose root carries `data-theme`. */
  readonly document?: ColorSchemeHostDocument;
  /** The preference's storage area. */
  readonly localStorage?: Pick<Storage, "getItem" | "setItem">;
  /** Evaluates the scheme query. */
  readonly matchMedia?: (query: string) => ColorSchemeMediaQuery;
  /** Registers the cross-document `storage` listener. */
  addEventListener?(type: "storage", listener: (event: ColorSchemeStorageEvent) => void): void;
  /** Removes the cross-document `storage` listener. */
  removeEventListener?(type: "storage", listener: (event: ColorSchemeStorageEvent) => void): void;
};

function attempt<T>(operation: () => T, fallback: T): T {
  try {
    return operation();
  } catch {
    return fallback;
  }
}

function noop(): void {
  // nothing to release
}

function once(release: () => void): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    attempt(release, undefined);
  };
}

/**
 * Creates the port over a browser-shaped host. It is the only owner of `window`, `document`,
 * `localStorage` and `matchMedia` for the color-scheme runtime, and it absorbs every platform
 * fault: a blocked or full storage area, a missing or throwing `matchMedia`, a legacy
 * `MediaQueryList`, and `storage` events from another area. Globals are read at call time,
 * so constructing it during a server render is inert.
 *
 * @param host - The window to adapt; defaults to `globalThis`.
 * @returns A total {@link ColorSchemePlatform}.
 */
export function createBrowserColorSchemePlatform(host: ColorSchemeHost = globalThis): ColorSchemePlatform {
  // Re-read per call: the getter can start or stop throwing, and the adapter is built lazily.
  const area = () => host.localStorage;
  return {
    root: {
      read: () => attempt(() => host.document?.documentElement.getAttribute("data-theme") ?? null, null),
      write(value, transition) {
        const restore =
          transition === undefined ? undefined : disableColorSchemeTransitions(host, transition.nonce);
        try {
          attempt(() => host.document?.documentElement.setAttribute("data-theme", value), undefined);
        } finally {
          restore?.();
        }
      },
    },
    storage: {
      read: (key) => attempt(() => area()?.getItem(key) ?? null, null),
      write(key, value) {
        attempt(() => area()?.setItem(key, value), undefined);
      },
      subscribe(key, onChange) {
        const listener = (event: ColorSchemeStorageEvent) => {
          if (event.key !== null && event.key !== key) return;
          // A `null` area or a sessionStorage event must not read as a preference change.
          if (!attempt(() => event.storageArea === area(), false)) return;
          onChange(event.newValue);
        };
        return attempt(() => {
          if (host.addEventListener === undefined) return noop;
          host.addEventListener("storage", listener);
          return once(() => host.removeEventListener?.("storage", listener));
        }, noop);
      },
    },
    media: {
      matches: () => attempt(() => host.matchMedia?.(SCHEME_QUERY).matches === true, false),
      subscribe(onChange) {
        return attempt(() => {
          const query = host.matchMedia?.(SCHEME_QUERY);
          if (query === undefined) return noop;
          if (query.addEventListener !== undefined) {
            query.addEventListener("change", onChange);
            return once(() => query.removeEventListener?.("change", onChange));
          }
          if (query.addListener !== undefined) {
            query.addListener(onChange);
            return once(() => query.removeListener?.(onChange));
          }
          return noop;
        }, noop);
      },
    },
  };
}
