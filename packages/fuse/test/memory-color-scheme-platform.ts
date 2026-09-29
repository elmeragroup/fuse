import { runInNewContext } from "node:vm";

import type { ColorSchemeBootstrapManifest } from "../src/theme/color-scheme";
import type { ColorSchemeHost } from "../src/theme/color-scheme-browser-platform";
import type { ColorSchemePlatform, ColorSchemeTransition } from "../src/theme/color-scheme-platform";

type ColorSchemeHostDocument = NonNullable<ColorSchemeHost["document"]>;
type ColorSchemeMediaQuery = ReturnType<NonNullable<ColorSchemeHost["matchMedia"]>>;
type ColorSchemeStorageListener = Parameters<NonNullable<ColorSchemeHost["addEventListener"]>>[1];

const SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** The simulated world a memory platform starts from. */
export type MemoryPlatformInit = {
  /** What a prior bootstrap or server render left in `data-theme`. */
  root?: string | null;
  /** The local storage area's contents. */
  stored?: Record<string, string>;
  /** Whether the scheme query matches. */
  prefersDark?: boolean;
  /**
   * `blocked`: the `localStorage` getter throws (SecurityError), so reads are `null`, writes
   * are dropped and no events arrive. `read-only`: `setItem` throws (QuotaExceededError).
   */
  storage?: "available" | "blocked" | "read-only";
  /**
   * `legacy`: the query has only `addListener`/`removeListener` (Safari < 14). `missing`: the
   * host has no `matchMedia`. `throwing`: `matchMedia` throws.
   */
  media?: "modern" | "legacy" | "missing" | "throwing";
};

/** Which storage area a simulated `storage` event reports; `none` is a `null` area. */
type MemoryStorageArea = "local" | "session" | "none";

/** One recorded `data-theme` write. */
export type MemoryRootWrite = { value: string; transition: ColorSchemeTransition };

/** One recorded storage write; `accepted` is false when the area refused it. */
export type MemoryStorageWrite = { key: string; value: string; accepted: boolean };

/** The window-shaped face: the bootstrap's vm sandbox, and a host for the browser adapter. */
export type MemoryColorSchemeHost = ColorSchemeHost & {
  /** A self-reference, because the bootstrap reads `window.matchMedia`. */
  readonly window: MemoryColorSchemeHost;
  /** The session area, so a session event can carry a distinct `storageArea`. */
  readonly sessionStorage: Pick<Storage, "getItem" | "setItem">;
  /** The slot the bootstrap writes its manifest to. */
  __ELMERA_COLOR_SCHEME_BOOTSTRAP__?: ColorSchemeBootstrapManifest;
};

/** An in-memory document with two faces over one simulated state. */
export type MemoryColorSchemePlatform = {
  /** The port face: satisfies the runtime's port with the same fault outcomes as the host. */
  readonly platform: ColorSchemePlatform;
  /** The window-shaped face over the same state. */
  readonly host: MemoryColorSchemeHost;
  /** Drives the simulated world; each call reaches subscribers of both faces. */
  readonly control: {
    /** Flips the scheme query and fires media listeners. */
    setPrefersDark(next: boolean): void;
    /** Another document wrote `key`; fires a `storage` event for `area` (default `local`). */
    remoteWrite(key: string, value: string, area?: MemoryStorageArea): void;
    /** Another document cleared an area; fires a `storage` event with a `null` key. */
    remoteClear(area?: MemoryStorageArea): void;
    /** Host code touched `data-theme` behind the runtime's back; not recorded as a write. */
    mutateRoot(value: string | null): void;
  };
  /** Independent observations for assertions. */
  readonly state: {
    /** The current `data-theme`, or `null`. */
    readonly root: string | null;
    /** Every attribute on the root element. */
    readonly attributes: Readonly<Record<string, string>>;
    /** Every inline style property set on the root element. */
    readonly rootStyle: Readonly<Record<string, string>>;
    /** The local area's contents. */
    readonly stored: Readonly<Record<string, string>>;
    /** Every `data-theme` write, in order. */
    readonly rootWrites: readonly MemoryRootWrite[];
    /** Every storage write attempt, in order. */
    readonly storageWrites: readonly MemoryStorageWrite[];
    /** Every key read from the local area, in order. */
    readonly storageReads: readonly string[];
    /** How many times the query's match was evaluated. */
    readonly mediaReads: number;
    /** Tags passed to `document.createElement`, which always throws. */
    readonly createdElements: readonly string[];
    /** Live listeners across both faces. */
    readonly activeSubscriptions: { storage: number; media: number };
  };
};

function removal<T>(set: Set<T>, item: T): () => void {
  return () => {
    set.delete(item);
  };
}

/**
 * Creates an in-memory document for node tests. The port face serves the runtime suite; the
 * host face runs the serialized bootstrap in a vm sandbox and backs the browser adapter, so
 * both see exactly the same simulated platform.
 *
 * @param init - The starting state and platform faults.
 * @returns The two faces, the controls and the observations.
 */
export function createMemoryColorSchemePlatform(init: MemoryPlatformInit = {}): MemoryColorSchemePlatform {
  const storageMode = init.storage ?? "available";
  const mediaMode = init.media ?? "modern";
  const attributes: Record<string, string> = {};
  if (init.root !== undefined && init.root !== null) {
    attributes["data-theme"] = init.root;
  }
  const rootStyle: Record<string, string> = {};
  const local = new Map(Object.entries(init.stored ?? {}));
  const session = new Map<string, string>();
  let prefersDark = init.prefersDark === true;

  const rootWrites: MemoryRootWrite[] = [];
  const storageWrites: MemoryStorageWrite[] = [];
  const storageReads: string[] = [];
  const createdElements: string[] = [];
  let mediaReads = 0;

  const portStorage = new Set<{ key: string; onChange: (newValue: string | null) => void }>();
  const portMedia = new Set<() => void>();
  const hostStorage = new Set<ColorSchemeStorageListener>();
  const hostMedia = new Set<() => void>();

  const mediaAvailable = mediaMode === "modern" || mediaMode === "legacy";

  function readMatch(): boolean {
    mediaReads += 1;
    return prefersDark;
  }

  function writeLocal(key: string, value: string): boolean {
    const accepted = storageMode === "available";
    storageWrites.push({ key, value, accepted });
    if (accepted) {
      local.set(key, value);
    }
    return accepted;
  }

  function readLocal(key: string): string | null {
    storageReads.push(key);
    return local.get(key) ?? null;
  }

  const localArea: Pick<Storage, "getItem" | "setItem"> = {
    getItem: readLocal,
    setItem(key, value) {
      if (!writeLocal(key, value)) {
        throw new DOMException("full", "QuotaExceededError");
      }
    },
  };

  const sessionArea: Pick<Storage, "getItem" | "setItem"> = {
    getItem: (key) => session.get(key) ?? null,
    setItem(key, value) {
      session.set(key, value);
    },
  };

  const documentElement: ColorSchemeHostDocument["documentElement"] & { style: Record<string, string> } = {
    style: rootStyle,
    getAttribute: (name) => attributes[name] ?? null,
    setAttribute(name, value) {
      attributes[name] = value;
      if (name === "data-theme") {
        rootWrites.push({ value, transition: undefined });
      }
    },
  };

  const hostDocument: ColorSchemeHostDocument = {
    documentElement,
    head: {
      append() {
        throw new Error("document.head.append is not available in the memory host");
      },
    },
    createElement(tagName) {
      createdElements.push(tagName);
      throw new Error(`document.createElement(${tagName}) is not available in the memory host`);
    },
    createTextNode() {
      throw new Error("document.createTextNode is not available in the memory host");
    },
    querySelector: () => null,
  };

  function mediaQuery(): ColorSchemeMediaQuery {
    if (mediaMode === "legacy") {
      return {
        get matches() {
          return readMatch();
        },
        addListener(listener) {
          hostMedia.add(listener);
        },
        removeListener(listener) {
          hostMedia.delete(listener);
        },
      };
    }
    return {
      get matches() {
        return readMatch();
      },
      addEventListener(_type, listener) {
        hostMedia.add(listener);
      },
      removeEventListener(_type, listener) {
        hostMedia.delete(listener);
      },
    };
  }

  const host: MemoryColorSchemeHost = {
    get window() {
      return host;
    },
    document: hostDocument,
    get localStorage() {
      if (storageMode === "blocked") {
        throw new DOMException("blocked", "SecurityError");
      }
      return localArea;
    },
    sessionStorage: sessionArea,
    addEventListener(_type, listener) {
      hostStorage.add(listener);
    },
    removeEventListener(_type, listener) {
      hostStorage.delete(listener);
    },
    // Inert: the memory document refuses the suppression style, so there is nothing to flush
    // or remove.
    getComputedStyle: () => undefined,
    setTimeout: () => undefined,
  };
  if (mediaMode !== "missing") {
    Object.defineProperty(host, "matchMedia", {
      enumerable: true,
      value(query: string): ColorSchemeMediaQuery {
        if (mediaMode === "throwing") {
          throw new Error("matchMedia is not supported");
        }
        if (query !== SCHEME_QUERY) {
          throw new Error(`Unexpected matchMedia query: ${query}`);
        }
        return mediaQuery();
      },
    });
  }

  function deliver(key: string | null, newValue: string | null, area: MemoryStorageArea): void {
    if (area === "local" && storageMode !== "blocked") {
      for (const subscriber of [...portStorage]) {
        if (key === null || key === subscriber.key) {
          subscriber.onChange(newValue);
        }
      }
    }
    const storageArea = area === "local" ? localArea : area === "session" ? sessionArea : null;
    for (const listener of [...hostStorage]) {
      listener({ key, newValue, storageArea });
    }
  }

  const platform: ColorSchemePlatform = {
    root: {
      read: () => attributes["data-theme"] ?? null,
      write(value, transition) {
        attributes["data-theme"] = value;
        rootWrites.push({ value, transition });
      },
    },
    storage: {
      read: (key) => (storageMode === "blocked" ? null : readLocal(key)),
      write(key, value) {
        writeLocal(key, value);
      },
      subscribe(key, onChange) {
        if (storageMode === "blocked") {
          return () => undefined;
        }
        const subscriber = { key, onChange };
        portStorage.add(subscriber);
        return removal(portStorage, subscriber);
      },
    },
    media: {
      matches: () => (mediaAvailable ? readMatch() : false),
      subscribe(onChange) {
        if (!mediaAvailable) {
          return () => undefined;
        }
        const listener = () => {
          onChange();
        };
        portMedia.add(listener);
        return removal(portMedia, listener);
      },
    },
  };

  return {
    platform,
    host,
    control: {
      setPrefersDark(next) {
        prefersDark = next;
        for (const listener of [...portMedia, ...hostMedia]) {
          listener();
        }
      },
      remoteWrite(key, value, area = "local") {
        if (area === "local") {
          local.set(key, value);
        } else if (area === "session") {
          session.set(key, value);
        }
        deliver(key, value, area);
      },
      remoteClear(area = "local") {
        if (area === "local") {
          local.clear();
        } else if (area === "session") {
          session.clear();
        }
        deliver(null, null, area);
      },
      mutateRoot(value) {
        if (value === null) {
          delete attributes["data-theme"];
        } else {
          attributes["data-theme"] = value;
        }
      },
    },
    state: {
      get root() {
        return attributes["data-theme"] ?? null;
      },
      attributes,
      rootStyle,
      get stored() {
        return Object.fromEntries(local);
      },
      rootWrites,
      storageWrites,
      storageReads,
      get mediaReads() {
        return mediaReads;
      },
      createdElements,
      get activeSubscriptions() {
        return { storage: portStorage.size + hostStorage.size, media: portMedia.size + hostMedia.size };
      },
    },
  };
}

/**
 * Runs a serialized bootstrap in a vm sandbox over a fresh memory host, so its writes land in
 * the same simulated state the runtime and the browser adapter see. The sandbox carries only
 * the globals the bootstrap may read, so a free identifier throws.
 *
 * @param source - The bootstrap source, as `colorSchemeScriptSource` emits it.
 * @param init - The starting state and platform faults.
 * @param existingManifest - A manifest an earlier bootstrap left on the window.
 * @returns The memory platform after the run.
 */
export function runColorSchemeBootstrap(
  source: string,
  init: MemoryPlatformInit = {},
  existingManifest?: ColorSchemeBootstrapManifest
): MemoryColorSchemePlatform {
  const memory = createMemoryColorSchemePlatform(init);
  if (existingManifest !== undefined) {
    memory.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__ = existingManifest;
  }
  runInNewContext(source, memory.host, { timeout: 1000 });
  return memory;
}
