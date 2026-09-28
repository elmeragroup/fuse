import { colorSchemeManifestsEqual, parseColorScheme } from "./color-scheme";
import type { ColorSchemeBootstrapManifest, UseColorSchemeResult } from "./color-scheme";
import type { ColorSchemePlatform } from "./color-scheme-platform";
import type { ColorScheme, ResolvedColorScheme } from "./color-scheme-types";

/** The bootstrap manifest plus the two runtime-only knobs, under the manifest's field names. */
export type ColorSchemeRuntimeConfig = ColorSchemeBootstrapManifest & {
  /** Suppress CSS transitions for every root write the runtime makes. */
  disableTransitionOnChange: boolean;
  /** The CSP nonce for the transition-suppression style. */
  nonce: string | undefined;
};

/** A ready-made `useColorScheme` value: stable identity between changes, stable setter. */
export type ColorSchemeRuntimeSnapshot = UseColorSchemeResult;

/**
 * The document's color-scheme state machine. It owns hydration, the platform subscriptions,
 * the force stack and every `data-theme` write; callers only configure, connect and force.
 */
export type ColorSchemeRuntime = {
  /** Registers a `useSyncExternalStore` listener; returns its unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** The current snapshot. Makes no platform call and allocates nothing. */
  getSnapshot: () => ColorSchemeRuntimeSnapshot;
  /** The hydration snapshot, which is the live one: React reads it only before `connect`. */
  getServerSnapshot: () => ColorSchemeRuntimeSnapshot;
  /**
   * Commits a config. Call it in an insertion effect on every commit: a field-equal config
   * changes nothing observable but still corrects an externally overwritten root. A changed
   * config refreshes the snapshot at once, notifies after a microtask, and while connected
   * re-reads the preference or the media query it depends on.
   */
  configure: (config: ColorSchemeRuntimeConfig) => void;
  /**
   * Hydrates from the platform, subscribes to storage and (with system support) media, and
   * corrects the root. Returns an idempotent disconnect that only unsubscribes; the hydrated
   * state stays, so StrictMode's connect, disconnect, connect makes no extra write.
   */
  connect: () => () => void;
  /**
   * Applies a force at a nesting depth: the deepest wins, and the latest at equal depth.
   * Runtime forces beat `forcedColorScheme`, which beats the preference. Safe before the
   * first `configure`. Returns an idempotent release.
   */
  force: (value: ColorScheme, depth: number) => () => void;
};

type ForceEntry = { readonly value: ColorScheme; readonly depth: number };

type Subscriptions = { readonly storage: () => void; readonly media: () => void };

/**
 * Before `connect` the preference is the configured default unless `setColorScheme` made it
 * explicit, and `prefersDark` is read lazily for a forced "system". Each `connect` starts a
 * fresh hydrated lifecycle whose `subscriptions` are `undefined` once disconnected; its
 * disconnect acts only while that object is still current.
 */
type Lifecycle =
  | {
      readonly _tag: "unhydrated";
      readonly preferenceSource: "default" | "explicit";
      readonly prefersDark: boolean | undefined;
    }
  | { readonly _tag: "hydrated"; prefersDark: boolean; subscriptions: Subscriptions | undefined };

type HydratedLifecycle = Extract<Lifecycle, { _tag: "hydrated" }>;

type Phase = "event" | "commit";

function noop(): void {
  // no subscription to release
}

function configsEqual(left: ColorSchemeRuntimeConfig, right: ColorSchemeRuntimeConfig): boolean {
  return (
    colorSchemeManifestsEqual(left, right) &&
    left.disableTransitionOnChange === right.disableTransitionOnChange &&
    left.nonce === right.nonce
  );
}

/**
 * Creates the runtime. Construction makes no platform call, so it is safe during a server
 * render, a StrictMode double render and a discarded state initializer.
 *
 * @param initialConfig - Stands in until the first `configure`, so an early `force` already
 *   writes with the right `forcedColorScheme` and nonce.
 * @param platform - The port the runtime reads and writes through.
 * @returns The runtime.
 */
export function createColorSchemeRuntime(
  initialConfig: ColorSchemeRuntimeConfig,
  platform: ColorSchemePlatform
): ColorSchemeRuntime {
  let config = initialConfig;
  let preference: ColorScheme = initialConfig.defaultColorScheme;
  let lifecycle: Lifecycle = { _tag: "unhydrated", preferenceSource: "default", prefersDark: undefined };
  const forces: ForceEntry[] = [];
  const listeners = new Set<() => void>();
  let notifyScheduled = false;

  const setColorScheme = (value: ColorScheme) => {
    preference = parseColorScheme(value, config.defaultColorScheme);
    if (lifecycle._tag === "unhydrated") {
      lifecycle = { ...lifecycle, preferenceSource: "explicit" };
    }
    platform.storage.write(config.storageKey, preference);
    reconcile();
    publish("event");
  };

  let snapshot: ColorSchemeRuntimeSnapshot = {
    colorScheme: preference,
    resolvedColorScheme: undefined,
    setColorScheme,
  };

  function activeForce(): ColorScheme | undefined {
    let winner: ForceEntry | undefined;
    for (const entry of forces) {
      if (winner === undefined || entry.depth >= winner.depth) {
        winner = entry;
      }
    }
    return winner?.value ?? config.forcedColorScheme;
  }

  function resolve(): ResolvedColorScheme {
    const source = activeForce() ?? preference;
    if (source === "light" || source === "dark") {
      return source;
    }
    if (!config.enableSystem) {
      return "light";
    }
    return prefersDark() ? "dark" : "light";
  }

  function prefersDark(): boolean {
    if (lifecycle._tag === "hydrated") {
      return lifecycle.prefersDark;
    }
    // Only a forced "system" before connect reaches here; connect always reads.
    if (lifecycle.prefersDark !== undefined) {
      return lifecycle.prefersDark;
    }
    const matches = platform.media.matches();
    lifecycle = { ...lifecycle, prefersDark: matches };
    return matches;
  }

  // The one write path: write iff a write is allowed and the root differs. Before connect an
  // unforced resolution from the default must not overwrite the bootstrap.
  function reconcile(): void {
    const writable =
      lifecycle._tag === "hydrated" ||
      lifecycle.preferenceSource === "explicit" ||
      activeForce() !== undefined;
    if (!writable) {
      return;
    }
    const next = resolve();
    if (platform.root.read() === next) {
      return;
    }
    platform.root.write(next, config.disableTransitionOnChange ? { nonce: config.nonce } : undefined);
  }

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  // Refreshes the snapshot synchronously. Event-phase changes notify at once; commit-phase
  // changes run in insertion effects, where a synchronous re-render is illegal, so they
  // share one microtask.
  function publish(phase: Phase): void {
    const resolvedColorScheme = lifecycle._tag === "hydrated" ? resolve() : undefined;
    if (snapshot.colorScheme === preference && snapshot.resolvedColorScheme === resolvedColorScheme) {
      return;
    }
    snapshot = { colorScheme: preference, resolvedColorScheme, setColorScheme };
    if (phase === "event") {
      notify();
      return;
    }
    if (notifyScheduled) {
      return;
    }
    notifyScheduled = true;
    queueMicrotask(() => {
      notifyScheduled = false;
      notify();
    });
  }

  function hydratePreference(): void {
    preference = parseColorScheme(platform.storage.read(config.storageKey), config.defaultColorScheme);
  }

  function subscribeStorage(): () => void {
    return platform.storage.subscribe(config.storageKey, (newValue) => {
      preference = parseColorScheme(newValue, config.defaultColorScheme);
      reconcile();
      publish("event");
    });
  }

  function subscribeMedia(hydrated: HydratedLifecycle): () => void {
    if (!config.enableSystem) {
      return noop;
    }
    return platform.media.subscribe(() => {
      hydrated.prefersDark = platform.media.matches();
      reconcile();
      publish("event");
    });
  }

  function unsubscribe(hydrated: HydratedLifecycle): void {
    hydrated.subscriptions?.storage();
    hydrated.subscriptions?.media();
    hydrated.subscriptions = undefined;
  }

  // Connected or not, a hydrated runtime rereads what a changed config makes stale.
  function rehydrate(
    hydrated: HydratedLifecycle,
    previous: ColorSchemeRuntimeConfig,
    next: ColorSchemeRuntimeConfig
  ): void {
    if (previous.storageKey !== next.storageKey || previous.defaultColorScheme !== next.defaultColorScheme) {
      hydratePreference();
    }
    if (next.enableSystem && !previous.enableSystem) {
      hydrated.prefersDark = platform.media.matches();
    }
  }

  // Moves only the subscriptions whose config input changed.
  function resubscribe(
    hydrated: HydratedLifecycle,
    previous: ColorSchemeRuntimeConfig,
    next: ColorSchemeRuntimeConfig
  ): void {
    const current = hydrated.subscriptions;
    if (current === undefined) {
      return;
    }
    let { storage, media } = current;
    if (previous.storageKey !== next.storageKey) {
      storage();
      storage = subscribeStorage();
    }
    if (previous.enableSystem !== next.enableSystem) {
      media();
      media = subscribeMedia(hydrated);
    }
    hydrated.subscriptions = { storage, media };
  }

  function applyConfig(next: ColorSchemeRuntimeConfig): void {
    const previous = config;
    config = next;
    if (lifecycle._tag === "unhydrated") {
      if (lifecycle.preferenceSource === "default") {
        preference = next.defaultColorScheme;
      }
      return;
    }
    rehydrate(lifecycle, previous, next);
    resubscribe(lifecycle, previous, next);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    getServerSnapshot() {
      return snapshot;
    },
    configure(next) {
      if (!configsEqual(config, next)) {
        applyConfig(next);
      }
      reconcile();
      publish("commit");
    },
    connect() {
      if (lifecycle._tag === "hydrated") {
        unsubscribe(lifecycle);
      }
      const hydrated: HydratedLifecycle = {
        _tag: "hydrated",
        prefersDark: platform.media.matches(),
        subscriptions: undefined,
      };
      hydratePreference();
      lifecycle = hydrated;
      hydrated.subscriptions = { storage: subscribeStorage(), media: subscribeMedia(hydrated) };
      reconcile();
      publish("event");
      return () => {
        if (lifecycle === hydrated) {
          unsubscribe(hydrated);
        }
      };
    },
    force(value, depth) {
      const entry: ForceEntry = { value, depth };
      forces.push(entry);
      reconcile();
      publish("commit");
      return () => {
        const index = forces.indexOf(entry);
        if (index < 0) {
          return;
        }
        forces.splice(index, 1);
        reconcile();
        publish("commit");
      };
    },
  };
}
