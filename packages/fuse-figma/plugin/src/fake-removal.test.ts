/**
 * The in-memory file's `remove()` on components, sets and the layers that hold them (rule 67). Unit
 * under test: the fake in `fake-figma.ts`, whose removals the planners' tests rely on. Oracles: the
 * probes FD1, FD2 and FD3, run through the Plugin API on a scratch file on 2026-11-20. A component or
 * a set that its own `remove()` deleted read `removed` false and `parent` null. It kept its id, key,
 * children and shared plugin data, and it was gone from the page. A removed variant left its set, and
 * an instance of it read `componentProperties` `{}`. A removed set kept its variants, and its instances
 * kept their properties. After `remove()` on a frame, the components it held and the instances that
 * showed them read `removed` true, and those instances' `getMainComponentAsync()` read null.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** The shared plugin data namespace and key the tests write and read. */
const NAMESPACE = "fuse";
const KEY = "key";

/** A blank file's API and a component named `name` on its page. */
function fileWithComponent(name: string) {
  const { figma } = createFakeFigma({ collections: [] });
  const component = figma.createComponent();
  component.name = name;
  return { figma, component };
}

/** A blank file's API, a set of two blank variants, and its `size=sm` and `size=lg` variants. */
function sizeSet() {
  const { figma, component: sm } = fileWithComponent("size=sm");
  const lg = figma.createComponent();
  lg.name = "size=lg";
  const set = figma.combineAsVariants([sm, lg], figma.currentPage);
  set.name = "Size set";
  return { figma, set, sm, lg };
}

describe("remove() on a component", () => {
  it("leaves the component an instance shows readable and off the page, as FD1 read", async () => {
    const { figma, component } = fileWithComponent("D1 main");
    const layer = figma.createFrame();
    layer.name = "D1 inner";
    component.appendChild(layer);
    component.setSharedPluginData(NAMESPACE, KEY, "main-key");
    layer.setSharedPluginData(NAMESPACE, KEY, "layer-key");
    const instance = component.createInstance();
    const { id, key } = component;

    component.remove();

    const main = await instance.getMainComponentAsync();
    expect(
      main === null
        ? null
        : {
            id: main.id,
            key: main.key,
            removed: main.removed,
            parent: main.parent,
            children: main.children.map((child) => child.name),
            data: main.getSharedPluginData(NAMESPACE, KEY),
            layerData: main.children.map((child) => child.getSharedPluginData(NAMESPACE, KEY)),
          }
    ).toEqual({
      id,
      key,
      removed: false,
      parent: null,
      children: ["D1 inner"],
      data: "main-key",
      layerData: ["layer-key"],
    });
    expect(instance.children.map((child) => child.getSharedPluginData(NAMESPACE, KEY))).toEqual([
      "layer-key",
    ]);
    expect(figma.currentPage.children.map((child) => child.id)).not.toContain(id);
  });

  it("leaves a component no instance shows readable too, as FD2 read", () => {
    const { component } = fileWithComponent("Lone");
    component.remove();
    expect([component.removed, component.parent]).toEqual([false, null]);
  });

  it("takes a variant out of its set, and its instance reads no properties, as FD2 read", async () => {
    const { set, sm, lg } = sizeSet();
    const instance = sm.createInstance();
    sm.remove();
    const main = await instance.getMainComponentAsync();
    expect({
      main: main?.id,
      removed: sm.removed,
      parent: sm.parent,
      properties: instance.componentProperties,
      set: set.children.map((child) => child.id),
    }).toEqual({ main: sm.id, removed: false, parent: null, properties: {}, set: [lg.id] });
  });
});

describe("remove() on a component set", () => {
  it("keeps its variants and its instances' properties, as FD2 read", () => {
    const { figma, set, sm, lg } = sizeSet();
    const instance = lg.createInstance();
    set.remove();
    expect({
      removed: set.removed,
      parent: set.parent,
      variant: [lg.parent?.id, set.children.map((child) => child.id)],
      onPage: figma.currentPage.children.some((child) => child.id === set.id),
      properties: instance.componentProperties,
    }).toEqual({
      removed: false,
      parent: null,
      variant: [set.id, [sm.id, lg.id]],
      onPage: false,
      properties: { size: { type: "VARIANT", value: "lg" } },
    });
  });
});

describe("remove() on a frame that holds components", () => {
  it("removes them and the instances outside it that show them, as FD3 read", async () => {
    const { figma, component: inner } = fileWithComponent("A");
    const outer = figma.createComponent();
    outer.name = "B";
    outer.appendChild(inner.createInstance());
    const frame = figma.createFrame();
    frame.appendChild(outer);
    frame.appendChild(inner);
    const innerInstance = inner.createInstance();
    const outerInstance = outer.createInstance();

    frame.remove();

    expect([inner.removed, outer.removed, innerInstance.removed, outerInstance.removed]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(figma.currentPage.children).toEqual([]);
    expect(await innerInstance.getMainComponentAsync()).toBeNull();
  });
});
