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
  it("does not let apply-then-discard change later snapshots", () => {
    const store = createColorSchemeRuntimeStore(config());
    const before = store.getSnapshot();

    store.applyConfig(config({ mountForce: "dark", defaultColorScheme: "dark" }));
    store.discardConfig();

    expect(store.getSnapshot()).toEqual(before);

    store.markMounted();
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");
    expect(store.getSnapshot().preference).toBe("light");
  });

  it("applies staged configuration only on commit", () => {
    const store = createColorSchemeRuntimeStore(config());
    store.markMounted();
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");

    store.applyConfig(config({ mountForce: "dark" }));
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");

    store.commitConfig();
    expect(store.getSnapshot().resolvedColorScheme).toBe("dark");
    expect(store.getSnapshot().preference).toBe("light");
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

    store.applyConfig(config({ mountForce: "light" }));
    store.commitConfig();
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
