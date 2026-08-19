import {
  parseColorScheme,
  readDocumentColorScheme,
  resolveColorScheme,
  writeDocumentColorScheme,
  writeStoredColorScheme,
} from "./color-scheme";
import type { ColorScheme } from "./color-scheme";
import { disableColorSchemeTransitions } from "./disable-transition";

export type ColorSchemeRuntimeConfig = {
  storageKey: string;
  defaultColorScheme: ColorScheme;
  enableSystem: boolean;
  mountForce: ColorScheme | undefined;
  disableTransitionOnChange: boolean;
  nonce: string | undefined;
};

export type ColorSchemeRuntimeSnapshot = {
  preference: ColorScheme;
  runtimeForce: ColorScheme | undefined;
  mounted: boolean;
  systemRevision: number;
};

export type ColorSchemeRuntimeStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ColorSchemeRuntimeSnapshot;
  getServerSnapshot: () => ColorSchemeRuntimeSnapshot;
  updateConfig: (next: ColorSchemeRuntimeConfig) => void;
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

export function createColorSchemeRuntimeStore(
  initialConfig: ColorSchemeRuntimeConfig
): ColorSchemeRuntimeStore {
  let config = initialConfig;
  let preference = initialConfig.defaultColorScheme;
  let mounted = false;
  let systemRevision = 0;
  const forceStack: Array<{ id: symbol; value: ColorScheme; depth: number }> = [];
  const listeners = new Set<() => void>();
  let notifyScheduled = false;
  let snapshot: ColorSchemeRuntimeSnapshot = {
    preference,
    runtimeForce: undefined,
    mounted,
    systemRevision,
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

  function emit(): void {
    snapshot = {
      preference,
      runtimeForce: peekRuntimeForce(),
      mounted,
      systemRevision,
    };
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

  function activeForce(): ColorScheme | undefined {
    return peekRuntimeForce() ?? config.mountForce;
  }

  function resolvedSource(): ColorScheme {
    return activeForce() ?? preference;
  }

  function writeResolvedNow(): void {
    applyDocumentColorScheme(
      resolveColorScheme(resolvedSource(), config.enableSystem),
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
    updateConfig(next) {
      config = next;
    },
    markMounted() {
      mounted = true;
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
      const resolved = resolveColorScheme(resolvedSource(), config.enableSystem);
      if (readDocumentColorScheme() !== resolved) {
        applyDocumentColorScheme(resolved, config.disableTransitionOnChange, config.nonce);
      }
    },
    bumpSystem() {
      systemRevision += 1;
      if (resolvedSource() === "system" && config.enableSystem) {
        writeResolvedNow();
      }
      emit();
    },
  };
}

export function resolvedColorSchemeFromSnapshot(
  snapshot: ColorSchemeRuntimeSnapshot,
  mountForce: ColorScheme | undefined,
  enableSystem: boolean
): "light" | "dark" | undefined {
  if (!snapshot.mounted) {
    return undefined;
  }
  return resolveColorScheme(snapshot.runtimeForce ?? mountForce ?? snapshot.preference, enableSystem);
}
