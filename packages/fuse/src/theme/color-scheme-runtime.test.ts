import { describe, expect, it } from "vitest";

import { createMemoryColorSchemePlatform } from "../../test/memory-color-scheme-platform";
import type { MemoryColorSchemePlatform, MemoryPlatformInit } from "../../test/memory-color-scheme-platform";
import { createColorSchemeRuntime } from "./color-scheme-runtime";
import type { ColorSchemeRuntime, ColorSchemeRuntimeConfig } from "./color-scheme-runtime";
import type { ColorScheme } from "./color-scheme-types";

// Unit under test: createColorSchemeRuntime over the in-memory port face. Every expectation
// is a hand-written literal: what the document root, the storage area and the subscription
// counts must show, never a value computed by the runtime's own resolution.

const KEY = "elmera-color-scheme";

function config(overrides: Partial<ColorSchemeRuntimeConfig> = {}): ColorSchemeRuntimeConfig {
  return {
    storageKey: KEY,
    defaultColorScheme: "system",
    enableSystem: true,
    forcedColorScheme: undefined,
    disableTransitionOnChange: false,
    nonce: undefined,
    ...overrides,
  };
}

function setup(init: MemoryPlatformInit = {}, overrides: Partial<ColorSchemeRuntimeConfig> = {}) {
  const memory = createMemoryColorSchemePlatform(init);
  const runtime = createColorSchemeRuntime(config(overrides), memory.platform);
  return { memory, runtime };
}

function countNotifications(runtime: ColorSchemeRuntime) {
  const counter = { count: 0 };
  runtime.subscribe(() => {
    counter.count += 1;
  });
  return counter;
}

function scheme(runtime: ColorSchemeRuntime): string {
  const { colorScheme, resolvedColorScheme } = runtime.getSnapshot();
  return `${colorScheme}/${resolvedColorScheme ?? "pending"}`;
}

const plain = (value: string) => ({ value, transition: undefined });

describe("construction", () => {
  it("makes no port call while constructing or reading snapshots", () => {
    const { memory, runtime } = setup({ root: "dark", stored: { [KEY]: "dark" }, prefersDark: true });

    runtime.getSnapshot();
    runtime.getServerSnapshot();

    expect(memory.state.storageReads).toEqual([]);
    expect(memory.state.mediaReads).toBe(0);
    expect(memory.state.rootWrites).toEqual([]);
    expect(scheme(runtime)).toBe("system/pending");
    expect(runtime.getServerSnapshot()).toBe(runtime.getSnapshot());
  });
});

describe("write gate before connect", () => {
  it("leaves a bootstrapped root alone on an unforced configure", () => {
    const { memory, runtime } = setup({ root: "dark" });

    runtime.configure(config());
    runtime.configure(config({ defaultColorScheme: "light" }));

    expect(memory.state.root).toBe("dark");
    expect(memory.state.rootWrites).toEqual([]);
    expect(scheme(runtime)).toBe("light/pending");
  });

  it.each<{
    name: string;
    root: string;
    overrides: Partial<ColorSchemeRuntimeConfig>;
    act: (runtime: ColorSchemeRuntime) => void;
    writes: unknown[];
  }>([
    {
      name: "a mount-level forcedColorScheme",
      root: "dark",
      overrides: {},
      act: (runtime) => runtime.configure(config({ forcedColorScheme: "light" })),
      writes: [plain("light")],
    },
    {
      name: "a runtime force, with the construction config standing in",
      root: "light",
      overrides: { disableTransitionOnChange: true, nonce: "csp" },
      act: (runtime) => {
        runtime.force("dark", 1);
        runtime.configure(config({ disableTransitionOnChange: true, nonce: "csp" }));
      },
      writes: [{ value: "dark", transition: { nonce: "csp" } }],
    },
  ])("writes $name before connect", ({ root, overrides, act, writes }) => {
    const { memory, runtime } = setup({ root }, overrides);
    act(runtime);
    expect(memory.state.rootWrites).toEqual(writes);
  });

  it("does not overwrite the bootstrap when the last force is released before connect", () => {
    const { memory, runtime } = setup(
      { root: "dark", stored: { [KEY]: "dark" } },
      { defaultColorScheme: "light" }
    );

    const release = runtime.force("dark", 1);
    release();

    expect(memory.state.root).toBe("dark");
    expect(memory.state.rootWrites).toEqual([]);

    runtime.connect();
    expect(memory.state.root).toBe("dark");
    expect(memory.state.rootWrites).toEqual([]);
  });

  it("keeps an explicit preference when a changed default is configured before connect", () => {
    const { memory, runtime } = setup({ root: "light" });

    runtime.getSnapshot().setColorScheme("dark");
    runtime.configure(config({ defaultColorScheme: "light" }));

    expect(memory.state.rootWrites).toEqual([plain("dark")]);
    expect(scheme(runtime)).toBe("dark/pending");
  });
});

describe("connect", () => {
  it("hydrates once, recovers a mismatched root and subscribes to both channels", () => {
    const { memory, runtime } = setup({ root: "light", stored: { [KEY]: "dark" } });
    const notified = countNotifications(runtime);

    runtime.connect();

    expect(memory.state.storageReads).toEqual([KEY]);
    expect(memory.state.mediaReads).toBe(1);
    expect(memory.state.rootWrites).toEqual([plain("dark")]);
    expect(memory.state.activeSubscriptions).toEqual({ storage: 1, media: 1 });
    expect(scheme(runtime)).toBe("dark/dark");
    expect(notified.count).toBe(1);
  });

  it("does not subscribe to the media query when system support is off", () => {
    const { memory, runtime } = setup({}, { enableSystem: false });

    runtime.connect();

    expect(memory.state.activeSubscriptions).toEqual({ storage: 1, media: 0 });
  });

  it("survives the StrictMode connect, disconnect, connect sequence with one subscription set", () => {
    const { memory, runtime } = setup({ root: "light", stored: { [KEY]: "dark" } });

    const disconnect = runtime.connect();
    disconnect();
    expect(memory.state.activeSubscriptions).toEqual({ storage: 0, media: 0 });
    expect(scheme(runtime)).toBe("dark/dark");

    runtime.connect();
    expect(memory.state.activeSubscriptions).toEqual({ storage: 1, media: 1 });
    expect(memory.state.rootWrites).toEqual([plain("dark")]);

    runtime.connect();
    expect(memory.state.activeSubscriptions).toEqual({ storage: 1, media: 1 });
  });

  it("ignores platform events after disconnect", () => {
    const { memory, runtime } = setup({ root: "dark", stored: { [KEY]: "dark" } });

    const disconnect = runtime.connect();
    disconnect();
    disconnect();
    memory.control.remoteWrite(KEY, "light");

    expect(memory.state.root).toBe("dark");
    expect(scheme(runtime)).toBe("dark/dark");
  });
});

describe("setColorScheme", () => {
  it("stores, writes and notifies in the same turn", () => {
    const { memory, runtime } = setup({ root: "light", stored: { [KEY]: "light" } });
    runtime.connect();
    const notified = countNotifications(runtime);

    runtime.getSnapshot().setColorScheme("dark");

    expect(memory.state.root).toBe("dark");
    expect(memory.state.stored).toEqual({ [KEY]: "dark" });
    expect(notified.count).toBe(1);
    expect(scheme(runtime)).toBe("dark/dark");
  });

  it("falls back to the configured default for an out-of-union value", () => {
    const { memory, runtime } = setup(
      { root: "dark", stored: { [KEY]: "dark" } },
      { defaultColorScheme: "light" }
    );
    runtime.connect();

    // SAFETY: a JavaScript caller can pass any string; the setter must parse it.
    runtime.getSnapshot().setColorScheme("sepia" as ColorScheme);

    expect(memory.state.root).toBe("light");
    expect(memory.state.stored).toEqual({ [KEY]: "light" });
    expect(scheme(runtime)).toBe("light/light");
  });

  it("keeps the root write and the notification when storage refuses the write", () => {
    const { memory, runtime } = setup({ root: "light", stored: { [KEY]: "light" }, storage: "read-only" });
    runtime.connect();
    const notified = countNotifications(runtime);

    runtime.getSnapshot().setColorScheme("dark");

    expect(memory.state.root).toBe("dark");
    expect(memory.state.storageWrites).toEqual([{ key: KEY, value: "dark", accepted: false }]);
    expect(memory.state.stored).toEqual({ [KEY]: "light" });
    expect(notified.count).toBe(1);
  });

  it("keeps a stable setter across snapshots", () => {
    const { runtime } = setup({ root: "light", stored: { [KEY]: "light" } });
    const before = runtime.getSnapshot().setColorScheme;

    runtime.connect();
    before("dark");

    expect(runtime.getSnapshot().setColorScheme).toBe(before);
  });
});

describe("remote storage", () => {
  it("applies another document's write in the same turn", () => {
    const { memory, runtime } = setup({ root: "light", stored: { [KEY]: "light" } });
    runtime.connect();
    const notified = countNotifications(runtime);

    memory.control.remoteWrite(KEY, "dark");

    expect(memory.state.root).toBe("dark");
    expect(notified.count).toBe(1);
    expect(scheme(runtime)).toBe("dark/dark");
  });

  it.each<{ name: string; overrides: Partial<ColorSchemeRuntimeConfig>; key: string; expected: string }>([
    { name: "the default key and fallback", overrides: {}, key: KEY, expected: "system/light" },
    {
      name: "a custom key and defaultColorScheme",
      overrides: { storageKey: "app-color-scheme", defaultColorScheme: "light" },
      key: "app-color-scheme",
      expected: "light/light",
    },
  ])("restores the configured fallback on a whole-area clear with $name", ({ overrides, key, expected }) => {
    const { memory, runtime } = setup({ root: "dark", stored: { [key]: "dark" } }, overrides);
    runtime.connect();

    memory.control.remoteClear();

    expect(memory.state.root).toBe("light");
    expect(scheme(runtime)).toBe(expected);
    expect(memory.state.storageWrites).toEqual([]);
  });

  it("receives nothing when storage is blocked", () => {
    const { memory, runtime } = setup({ root: "light", storage: "blocked" }, { defaultColorScheme: "light" });
    runtime.connect();

    memory.control.remoteWrite(KEY, "dark");

    expect(memory.state.root).toBe("light");
    expect(memory.state.activeSubscriptions).toEqual({ storage: 0, media: 1 });
    expect(scheme(runtime)).toBe("light/light");
  });

  it.each<{
    name: string;
    init: MemoryPlatformInit;
    event: (memory: MemoryColorSchemePlatform) => void;
    expected: string;
  }>([
    {
      name: "another document's write",
      init: { root: "light", stored: { [KEY]: "light" } },
      event: (memory) => memory.control.remoteWrite(KEY, "dark"),
      expected: "dark/light",
    },
    {
      name: "a whole-area clear that restores the fallback",
      init: { root: "light", stored: { [KEY]: "dark" }, prefersDark: true },
      event: (memory) => memory.control.remoteClear(),
      expected: "system/light",
    },
  ])("updates the preference but keeps a runtime force's root on $name", ({ init, event, expected }) => {
    const { memory, runtime } = setup(init);
    runtime.connect();
    runtime.force("light", 1);

    event(memory);

    expect(memory.state.root).toBe("light");
    expect(scheme(runtime)).toBe(expected);
  });
});

describe("media", () => {
  it.each([
    { name: "follows the query while the preference is system", stored: "system", root: "dark" },
    { name: "ignores the query for an explicit preference", stored: "light", root: "light" },
  ])("$name", ({ stored, root }) => {
    const { memory, runtime } = setup({ root: "light", stored: { [KEY]: stored }, prefersDark: false });
    runtime.connect();

    memory.control.setPrefersDark(true);

    expect(memory.state.root).toBe(root);
    expect(scheme(runtime)).toBe(`${stored}/${root}`);
  });

  it("resolves system to light when the platform cannot evaluate the query", () => {
    const { memory, runtime } = setup({ stored: { [KEY]: "system" }, prefersDark: true, media: "missing" });
    runtime.connect();

    expect(memory.state.root).toBe("light");
    expect(memory.state.activeSubscriptions.media).toBe(0);
  });

  it("follows the query under a mount-level or runtime-forced system and ignores it under a forced light", () => {
    const { memory, runtime } = setup(
      { root: "light", stored: { [KEY]: "light" }, prefersDark: false },
      { forcedColorScheme: "system" }
    );
    runtime.connect();

    memory.control.setPrefersDark(true);
    expect(memory.state.root).toBe("dark");
    expect(scheme(runtime)).toBe("light/dark");

    runtime.configure(config({ forcedColorScheme: "light" }));
    memory.control.setPrefersDark(false);
    memory.control.setPrefersDark(true);
    expect(memory.state.root).toBe("light");

    const forced = setup({ root: "light", stored: { [KEY]: "light" }, prefersDark: false });
    forced.runtime.connect();
    forced.runtime.force("system", 1);

    forced.memory.control.setPrefersDark(true);

    expect(forced.memory.state.root).toBe("dark");
    expect(scheme(forced.runtime)).toBe("light/dark");
  });

  it("does not read the query while serving snapshots or on post-mount commits", () => {
    const { memory, runtime } = setup({ stored: { [KEY]: "system" }, prefersDark: true });
    runtime.connect();
    const reads = memory.state.mediaReads;

    runtime.getSnapshot();
    runtime.getSnapshot();
    runtime.getServerSnapshot();
    runtime.configure(config());
    runtime.configure(config());
    runtime.force("system", 1)();

    expect(reads).toBe(1);
    expect(memory.state.mediaReads).toBe(1);
  });
});

describe("force stack", () => {
  it.each<{ name: string; start: ColorScheme; innerDepth: number; expected: string }>([
    {
      name: "the deepest force whatever the application order",
      start: "dark",
      innerDepth: 2,
      expected: "light",
    },
    { name: "the later force at equal depth", start: "light", innerDepth: 1, expected: "dark" },
  ])("lets $name win", ({ start, innerDepth, expected }) => {
    const { memory, runtime } = setup({ root: start, stored: { [KEY]: start } });
    runtime.connect();

    runtime.force("light", innerDepth);
    runtime.force("dark", 1);

    expect(memory.state.root).toBe(expected);
  });

  it("restores the next force, then the mount force, then the preference", () => {
    const { memory, runtime } = setup(
      { root: "light", stored: { [KEY]: "light" } },
      { forcedColorScheme: "dark" }
    );
    runtime.connect();
    const releaseOuter = runtime.force("system", 1);
    const releaseInner = runtime.force("light", 2);
    expect(memory.state.root).toBe("light");

    releaseInner();
    releaseInner();
    expect(memory.state.root).toBe("light");
    expect(scheme(runtime)).toBe("light/light");

    releaseOuter();
    expect(memory.state.root).toBe("dark");

    runtime.configure(config());
    expect(memory.state.root).toBe("light");
  });

  it("refreshes the snapshot at once and notifies after a microtask", async () => {
    const { runtime } = setup({ root: "light", stored: { [KEY]: "light" } });
    runtime.connect();
    const notified = countNotifications(runtime);

    const release = runtime.force("dark", 1);
    expect(scheme(runtime)).toBe("light/dark");
    release();
    expect(scheme(runtime)).toBe("light/light");
    expect(notified.count).toBe(0);

    await Promise.resolve();
    expect(notified.count).toBe(1);
  });
});

describe("configure", () => {
  it("refreshes the snapshot synchronously and batches one notification", async () => {
    const { runtime } = setup({ root: "light", stored: { [KEY]: "light" } });
    runtime.connect();
    const notified = countNotifications(runtime);

    runtime.configure(config({ forcedColorScheme: "dark" }));
    expect(scheme(runtime)).toBe("light/dark");
    runtime.configure(config({ forcedColorScheme: "system", enableSystem: false }));
    expect(scheme(runtime)).toBe("light/light");
    expect(notified.count).toBe(0);

    await Promise.resolve();
    expect(notified.count).toBe(1);
  });

  it("re-reads the new key and moves the storage subscription", () => {
    const { memory, runtime } = setup({ root: "dark", stored: { [KEY]: "dark", app: "light" } });
    runtime.connect();

    runtime.configure(config({ storageKey: "app" }));
    expect(memory.state.storageReads).toEqual([KEY, "app"]);
    expect(memory.state.root).toBe("light");
    expect(memory.state.activeSubscriptions.storage).toBe(1);

    memory.control.remoteWrite(KEY, "dark");
    expect(memory.state.root).toBe("light");
    memory.control.remoteWrite("app", "dark");
    expect(memory.state.root).toBe("dark");
  });

  it("subscribes and unsubscribes the media query as system support toggles", () => {
    const { memory, runtime } = setup({ stored: { [KEY]: "system" }, prefersDark: true });
    runtime.connect();
    expect(memory.state.activeSubscriptions.media).toBe(1);

    runtime.configure(config({ enableSystem: false }));
    expect(memory.state.activeSubscriptions.media).toBe(0);
    expect(memory.state.root).toBe("light");

    runtime.configure(config());
    expect(memory.state.activeSubscriptions.media).toBe(1);
    expect(memory.state.root).toBe("dark");
  });
});

describe("transitions", () => {
  it("asks the platform to suppress transitions only with disableTransitionOnChange", () => {
    const suppressed = setup(
      { root: "light", stored: { [KEY]: "light" } },
      { disableTransitionOnChange: true, nonce: "csp" }
    );
    suppressed.runtime.connect();
    suppressed.runtime.getSnapshot().setColorScheme("dark");

    const animated = setup({ root: "light", stored: { [KEY]: "light" } });
    animated.runtime.connect();
    animated.runtime.getSnapshot().setColorScheme("dark");

    expect(suppressed.memory.state.rootWrites).toEqual([{ value: "dark", transition: { nonce: "csp" } }]);
    expect(animated.memory.state.rootWrites).toEqual([plain("dark")]);
  });
});

describe("idempotence and recovery", () => {
  it("never rewrites a root that already holds the resolved value", () => {
    const { memory, runtime } = setup({ root: "dark", stored: { [KEY]: "dark" } });
    runtime.connect();

    runtime.getSnapshot().setColorScheme("dark");
    runtime.force("dark", 1);
    memory.control.setPrefersDark(true);

    expect(memory.state.rootWrites).toEqual([]);
  });

  it("corrects an external data-theme overwrite on the next equal configure without notifying", async () => {
    const { memory, runtime } = setup({ root: "dark", stored: { [KEY]: "dark" } });
    runtime.connect();
    const before = runtime.getSnapshot();
    const notified = countNotifications(runtime);

    memory.control.mutateRoot("light");
    runtime.configure(config());
    await Promise.resolve();

    expect(memory.state.root).toBe("dark");
    expect(memory.state.rootWrites).toEqual([plain("dark")]);
    expect(runtime.getSnapshot()).toBe(before);
    expect(notified.count).toBe(0);

    runtime.configure(config());
    expect(memory.state.rootWrites).toEqual([plain("dark")]);
  });
});
