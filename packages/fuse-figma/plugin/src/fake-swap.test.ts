/**
 * The in-memory file's `swapComponent` on a nested instance's sublayer (rule 48). Unit under test:
 * the fake in `fake-figma.ts`, whose sublayer keys the plugin's key walk reads. Oracle: probe FD4, run
 * through the Plugin API on a scratch file on 2026-11-20. Component `B` held an instance of `A`,
 * keyed `slot`, and an instance of `B` held the sublayer that stands for it. A swap of that sublayer
 * to `A` left it reading `slot` with no override listed. A swap to another component `C` read `C`'s
 * key, as PK read for a swapped icon.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** The shared plugin data namespace and key the tests write and read. */
const NAMESPACE = "fuse";
const KEY = "key";

/** FD4's file: `A` and `C` keyed, `B` holding an instance of `A` keyed `slot`, and an instance of `B`. */
function fd4File() {
  const { figma } = createFakeFigma({ collections: [] });
  const a = figma.createComponent();
  a.setSharedPluginData(NAMESPACE, KEY, "key-A");
  const c = figma.createComponent();
  c.setSharedPluginData(NAMESPACE, KEY, "key-C");
  const b = figma.createComponent();
  const slot = a.createInstance();
  slot.setSharedPluginData(NAMESPACE, KEY, "slot");
  b.appendChild(slot);
  const instance = b.createInstance();
  const sublayer = instance.children[0];
  if (sublayer?.type !== "INSTANCE") {
    throw new Error(
      `Expected the first child of B's instance to be an INSTANCE, got ${sublayer?.type ?? "no child"}.`
    );
  }
  return { a, c, slot, instance, sublayer };
}

describe("swapComponent on a nested instance's sublayer", () => {
  it("changes nothing when it names the component the sublayer shows, as FD4 read", () => {
    const { a, instance, sublayer } = fd4File();
    sublayer.swapComponent(a);
    expect([sublayer.getSharedPluginData(NAMESPACE, KEY), instance.overrides]).toEqual(["slot", []]);
  });

  it("compares the component the sublayer shows now, after its main layer swapped", () => {
    const { c, slot, instance, sublayer } = fd4File();
    // The main layer's swap makes the sublayer show `C` while it never swapped apart (PK2).
    slot.swapComponent(c);
    sublayer.swapComponent(c);
    expect([sublayer.getSharedPluginData(NAMESPACE, KEY), instance.overrides]).toEqual(["slot", []]);
  });

  it("reads the other component's key when it names another, as FD4 and PK read", () => {
    const { c, sublayer } = fd4File();
    sublayer.swapComponent(c);
    expect(sublayer.getSharedPluginData(NAMESPACE, KEY)).toBe("key-C");
  });
});
