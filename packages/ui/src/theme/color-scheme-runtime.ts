import {
  parseColorScheme,
  readDocumentColorScheme,
  resolveSystemColorScheme,
  writeDocumentColorScheme,
  writeStoredColorScheme,
} from "./color-scheme";
import type { ColorScheme } from "./color-scheme";
import { disableColorSchemeTransitions } from "./disable-transition";

export type ColorSchemeRuntimeConfig = {
  storageKey: string;
  defaultColorScheme: ColorScheme;
  enableSystem: boolean;
  /** Same primitive as ColorSchemeOptions.forcedColorScheme / ColorSchemeBootstrapManifest.forcedColorScheme. */
  mountForce: ColorScheme | undefined;
  disableTransitionOnChange: boolean;
  nonce: string | undefined;
};

export type ColorSchemeRuntimeSnapshot = {
  preference: ColorScheme;
  runtimeForce: ColorScheme | undefined;
  mounted: boolean;
  resolvedColorScheme: "light" | "dark" | undefined;
};

export type ColorSchemeRuntimeStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ColorSchemeRuntimeSnapshot;
  getServerSnapshot: () => ColorSchemeRuntimeSnapshot;
  commitConfig: (next: ColorSchemeRuntimeConfig) => void;
  markMounted: () => void;
  hydratePreference: (next: ColorScheme) => void;
  setPreference: (next: ColorScheme) => void;
  receivePreference: (next: ColorScheme) => void;
  setRuntimeForce: (id: symbol, value: ColorScheme | undefined, depth: number) => void;
  applyDocument: () => void;
  recoverDocument: () => void;
  bumpSystem: () => void;
};

function applyDocumentColorScheme(
  value: "light" | "dark",
  disableTransitionOnChange: boolean,
  nonce: string | undefined
): void {
  const restore = disableTransitionOnChange ? disableColorSchemeTransitions(nonce) : undefined;
  try {
    writeDocumentColorScheme(value);
  } finally {
    restore?.();
  }
}

function configsEqual(left: ColorSchemeRuntimeConfig, right: ColorSchemeRuntimeConfig): boolean {
  return (
    left.storageKey === right.storageKey &&
    left.defaultColorScheme === right.defaultColorScheme &&
    left.enableSystem === right.enableSystem &&
    left.mountForce === right.mountForce &&
    left.disableTransitionOnChange === right.disableTransitionOnChange &&
    left.nonce === right.nonce
  );
}

export function createColorSchemeRuntimeStore(
  initialConfig: ColorSchemeRuntimeConfig
): ColorSchemeRuntimeStore {
  let config = initialConfig;
  let preference = initialConfig.defaultColorScheme;
  let mounted = false;
  let systemScheme: "light" | "dark" = "light";
  let systemSchemeRead = false;
  const forceStack: Array<{ id: symbol; value: ColorScheme; depth: number }> = [];
  const listeners = new Set<() => void>();
  let notifyScheduled = false;
  let snapshot: ColorSchemeRuntimeSnapshot = {
    preference,
    runtimeForce: undefined,
    mounted,
    resolvedColorScheme: undefined,
  };

  function peekRuntimeForce(): ColorScheme | undefined {
    let winner: { id: symbol; value: ColorScheme; depth: number } | undefined;
    for (const entry of forceStack) {
      if (winner === undefined || entry.depth >= winner.depth) {
        winner = entry;
      }
    }
    return winner?.value;
  }

  function activeForce(): ColorScheme | undefined {
    return peekRuntimeForce() ?? config.mountForce;
  }

  function resolvedSource(): ColorScheme {
    return activeForce() ?? preference;
  }

  function currentSystemScheme(): "light" | "dark" {
    if (!systemSchemeRead) {
      systemScheme = resolveSystemColorScheme();
      systemSchemeRead = true;
    }
    return systemScheme;
  }

  function resolveFromCachedSystem(source: ColorScheme): "light" | "dark" {
    if (source === "light" || source === "dark") {
      return source;
    }
    if (!config.enableSystem) {
      return "light";
    }
    return currentSystemScheme();
  }

  function resolvedForConsumers(): "light" | "dark" | undefined {
    if (!mounted) {
      return undefined;
    }
    return resolveFromCachedSystem(resolvedSource());
  }

  function refreshSnapshot(): void {
    snapshot = {
      preference,
      runtimeForce: peekRuntimeForce(),
      mounted,
      resolvedColorScheme: resolvedForConsumers(),
    };
  }

  function emit(): void {
    refreshSnapshot();
    for (const listener of listeners) {
      listener();
    }
  }

  function scheduleNotify(): void {
    if (notifyScheduled) {
      return;
    }
    notifyScheduled = true;
    queueMicrotask(() => {
      notifyScheduled = false;
      emit();
    });
  }

  function writeResolvedNow(): void {
    applyDocumentColorScheme(
      resolveFromCachedSystem(resolvedSource()),
      config.disableTransitionOnChange,
      config.nonce
    );
  }

  function writeResolvedIfReady(): void {
    if (!mounted && activeForce() === undefined) {
      return;
    }
    writeResolvedNow();
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
    commitConfig(next) {
      if (configsEqual(config, next)) {
        return;
      }
      config = next;
      writeResolvedIfReady();
      refreshSnapshot();
      scheduleNotify();
    },
    markMounted() {
      mounted = true;
      systemScheme = resolveSystemColorScheme();
      systemSchemeRead = true;
      emit();
    },
    hydratePreference(next) {
      preference = next;
      emit();
    },
    setPreference(next) {
      preference = parseColorScheme(next, config.defaultColorScheme);
      writeStoredColorScheme(config.storageKey, preference);
      if (activeForce() === undefined) {
        writeResolvedNow();
      }
      emit();
    },
    receivePreference(next) {
      preference = parseColorScheme(next, config.defaultColorScheme);
      if (activeForce() === undefined) {
        writeResolvedNow();
      }
      emit();
    },
    setRuntimeForce(id, value, depth) {
      const index = forceStack.findIndex((entry) => entry.id === id);
      if (value === undefined) {
        if (index >= 0) {
          forceStack.splice(index, 1);
        }
      } else if (index >= 0) {
        forceStack[index] = { id, value, depth };
      } else {
        forceStack.push({ id, value, depth });
      }
      writeResolvedNow();
      scheduleNotify();
    },
    applyDocument() {
      writeResolvedIfReady();
    },
    recoverDocument() {
      const resolved = resolveFromCachedSystem(resolvedSource());
      if (readDocumentColorScheme() !== resolved) {
        applyDocumentColorScheme(resolved, config.disableTransitionOnChange, config.nonce);
      }
    },
    bumpSystem() {
      systemScheme = resolveSystemColorScheme();
      systemSchemeRead = true;
      if (resolvedSource() === "system" && config.enableSystem) {
        writeResolvedNow();
      }
      emit();
    },
  };
}
