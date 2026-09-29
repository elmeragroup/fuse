import { describe, expect, it } from "vitest";

import { createMemoryColorSchemePlatform } from "../../test/memory-color-scheme-platform";
import type { MemoryColorSchemePlatform, MemoryPlatformInit } from "../../test/memory-color-scheme-platform";
import { createBrowserColorSchemePlatform } from "./color-scheme-browser-platform";

// Unit under test: createBrowserColorSchemePlatform over the memory host's window-shaped
// face, which models modern, legacy, missing and throwing platform APIs. Expectations are
// literal outcomes: what the port returns or delivers, and the memory host's own records.

const KEY = "elmera-color-scheme";

function adapt(init: MemoryPlatformInit = {}) {
  const memory = createMemoryColorSchemePlatform(init);
  return { memory, browser: createBrowserColorSchemePlatform(memory.host) };
}

function recordStorage(subscribe: (onChange: (value: string | null) => void) => () => void) {
  const delivered: Array<string | null> = [];
  const unsubscribe = subscribe((value) => {
    delivered.push(value);
  });
  return { delivered, unsubscribe };
}

describe("browser adapter root", () => {
  it("reads and writes data-theme on the document element", () => {
    const { memory, browser } = adapt({ root: "light" });

    expect(browser.root.read()).toBe("light");
    browser.root.write("dark", undefined);

    expect(memory.state.root).toBe("dark");
    expect(memory.state.rootWrites).toEqual([{ value: "dark", transition: undefined }]);
  });

  it("still writes when the host cannot build the transition-suppression style", () => {
    const { memory, browser } = adapt({ root: "light" });

    browser.root.write("dark", { nonce: "csp" });

    expect(memory.state.root).toBe("dark");
    expect(memory.state.createdElements).toEqual(["style"]);
  });

  it("is inert over a host without a document", () => {
    const browser = createBrowserColorSchemePlatform({
      getComputedStyle: () => undefined,
      setTimeout: () => undefined,
    });

    expect(browser.root.read()).toBeNull();
    expect(() => {
      browser.root.write("dark", { nonce: undefined });
    }).not.toThrow();
  });
});

describe("browser adapter storage", () => {
  it("reads and writes the local area", () => {
    const { memory, browser } = adapt({ stored: { [KEY]: "dark" } });

    expect(browser.storage.read(KEY)).toBe("dark");
    browser.storage.write(KEY, "light");

    expect(memory.state.stored).toEqual({ [KEY]: "light" });
  });

  it("reads null, drops writes and ignores events when the localStorage getter throws", () => {
    const { memory, browser } = adapt({ stored: { [KEY]: "dark" }, storage: "blocked" });
    const { delivered } = recordStorage((onChange) => browser.storage.subscribe(KEY, onChange));

    expect(browser.storage.read(KEY)).toBeNull();
    expect(() => {
      browser.storage.write(KEY, "light");
    }).not.toThrow();
    memory.control.remoteWrite(KEY, "light");

    expect(delivered).toEqual([]);
    expect(memory.state.storageWrites).toEqual([]);
  });

  it("swallows a quota failure on write", () => {
    const { memory, browser } = adapt({ stored: { [KEY]: "dark" }, storage: "read-only" });

    expect(() => {
      browser.storage.write(KEY, "light");
    }).not.toThrow();

    expect(memory.state.storageWrites).toEqual([{ key: KEY, value: "light", accepted: false }]);
    expect(memory.state.stored).toEqual({ [KEY]: "dark" });
  });

  it("delivers a change to the key and a whole-area clear as null", () => {
    const { memory, browser } = adapt();
    const { delivered } = recordStorage((onChange) => browser.storage.subscribe(KEY, onChange));

    memory.control.remoteWrite(KEY, "dark");
    memory.control.remoteClear();

    expect(delivered).toEqual(["dark", null]);
  });

  it.each<{ name: string; event: (memory: MemoryColorSchemePlatform) => void }>([
    { name: "an unrelated key", event: (memory) => memory.control.remoteWrite("other-key", "dark", "local") },
    {
      name: "the session area reusing the key",
      event: (memory) => memory.control.remoteWrite(KEY, "dark", "session"),
    },
    { name: "a null storage area", event: (memory) => memory.control.remoteWrite(KEY, "dark", "none") },
    { name: "a session-area clear", event: (memory) => memory.control.remoteClear("session") },
  ])("ignores an event from $name", ({ event }) => {
    const { memory, browser } = adapt();
    const { delivered } = recordStorage((onChange) => browser.storage.subscribe(KEY, onChange));

    event(memory);

    expect(delivered).toEqual([]);
  });

  it("unsubscribes idempotently", () => {
    const { memory, browser } = adapt();
    const { delivered, unsubscribe } = recordStorage((onChange) => browser.storage.subscribe(KEY, onChange));
    expect(memory.state.activeSubscriptions.storage).toBe(1);

    unsubscribe();
    unsubscribe();
    memory.control.remoteWrite(KEY, "dark");

    expect(delivered).toEqual([]);
    expect(memory.state.activeSubscriptions.storage).toBe(0);
  });
});

describe("browser adapter media", () => {
  it.each(["modern", "legacy"] as const)("subscribes through the %s MediaQueryList API", (media) => {
    const { memory, browser } = adapt({ prefersDark: false, media });
    const flips: boolean[] = [];

    const unsubscribe = browser.media.subscribe(() => {
      flips.push(browser.media.matches());
    });
    expect(memory.state.activeSubscriptions.media).toBe(1);
    memory.control.setPrefersDark(true);
    unsubscribe();
    unsubscribe();
    memory.control.setPrefersDark(false);

    expect(flips).toEqual([true]);
    expect(memory.state.activeSubscriptions.media).toBe(0);
  });

  it.each(["missing", "throwing"] as const)(
    "reports no match and no subscription when matchMedia is %s",
    (media) => {
      const { memory, browser } = adapt({ prefersDark: true, media });
      const flips: boolean[] = [];

      const unsubscribe = browser.media.subscribe(() => {
        flips.push(true);
      });
      memory.control.setPrefersDark(false);

      expect(browser.media.matches()).toBe(false);
      expect(flips).toEqual([]);
      expect(memory.state.activeSubscriptions.media).toBe(0);
      expect(unsubscribe).not.toThrow();
    }
  );
});
