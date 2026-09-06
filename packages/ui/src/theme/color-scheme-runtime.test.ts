import { afterEach, describe, expect, it, vi } from "vitest";

import { createColorSchemeRuntimeStore } from "./color-scheme-runtime";
import type { ColorSchemeRuntimeConfig } from "./color-scheme-runtime";

function config(overrides: Partial<ColorSchemeRuntimeConfig> = {}): ColorSchemeRuntimeConfig {
  return {
    storageKey: "elmera-color-scheme",
    defaultColorScheme: "light",
    enableSystem: false,
    mountForce: undefined,
    disableTransitionOnChange: false,
    nonce: undefined,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("color-scheme runtime store config commit", () => {
  it("keeps the snapshot and listeners unchanged for equal committed configuration", async () => {
    const store = createColorSchemeRuntimeStore(config());
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    store.commitConfig(config());
    await Promise.resolve();

    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("updates the snapshot synchronously and batches notifications after commit", async () => {
    const store = createColorSchemeRuntimeStore(config());
    store.markMounted();
    const listener = vi.fn();
    store.subscribe(listener);

    store.commitConfig(config({ mountForce: "dark" }));
    expect(store.getSnapshot().resolvedColorScheme).toBe("dark");
    expect(store.getSnapshot().preference).toBe("light");
    expect(listener).not.toHaveBeenCalled();

    store.commitConfig(config({ mountForce: "light" }));
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("color-scheme runtime snapshot resolution", () => {
  it("keeps resolvedColorScheme undefined until mounted", () => {
    const store = createColorSchemeRuntimeStore(config({ defaultColorScheme: "dark" }));
    expect(store.getSnapshot().resolvedColorScheme).toBeUndefined();
    expect(store.getSnapshot().preference).toBe("dark");
    expect(store.getSnapshot().mounted).toBe(false);

    store.markMounted();
    expect(store.getSnapshot().resolvedColorScheme).toBe("dark");
    expect(store.getSnapshot().mounted).toBe(true);
  });

  it("resolves preference, mount force, and runtime force from the same snapshot", async () => {
    const store = createColorSchemeRuntimeStore(config());
    store.markMounted();
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");

    store.setPreference("dark");
    expect(store.getSnapshot().resolvedColorScheme).toBe("dark");
    expect(store.getSnapshot().preference).toBe("dark");

    store.commitConfig(config({ mountForce: "light" }));
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");
    expect(store.getSnapshot().preference).toBe("dark");

    const lock = Symbol("force");
    store.setRuntimeForce(lock, "dark", 1);
    await Promise.resolve();
    expect(store.getSnapshot().resolvedColorScheme).toBe("dark");
    expect(store.getSnapshot().runtimeForce).toBe("dark");
    expect(store.getSnapshot().preference).toBe("dark");

    store.setRuntimeForce(lock, undefined, 1);
    await Promise.resolve();
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");
    expect(store.getSnapshot().runtimeForce).toBeUndefined();
  });
});
