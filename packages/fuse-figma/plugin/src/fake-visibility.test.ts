/**
 * The in-memory file's `visible`, which the plugin writes to draw a part under `visibility: hidden`.
 * Unit under test: the fake in `fake-figma.ts`, whose layout and sizing the planners' tests rely on.
 * Oracles: the plugin typings, where any scene node's `visible` is writable and reads back what was
 * written; Figma's auto layout, which lays a hidden layer out as if it were gone, as a real file did
 * for a property-hidden layer (PB); and the override model of rule 37, where a write on an instance's
 * sublayer overrides its main layer's value.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

describe("a layer the plugin hides with a write of visible", () => {
  it("leaves the hugging auto layout around it", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const component = figma.createComponent();
    component.resize(100, 20);
    figma.combineAsVariants([component], figma.currentPage);
    const host = figma.createFrame();
    host.layoutMode = "HORIZONTAL";
    host.primaryAxisSizingMode = "AUTO";
    host.counterAxisSizingMode = "AUTO";
    const instance = component.createInstance();
    host.appendChild(instance);
    instance.visible = false;
    expect({ visible: instance.visible, width: host.width, height: host.height }).toEqual({
      visible: false,
      width: 0,
      height: 0,
    });
  });

  it("hides an instance's sublayer that overrides its main layer, and only that one", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const main = figma.createComponent();
    main.appendChild(figma.createFrame());
    figma.combineAsVariants([main], figma.currentPage);
    const [first, second] = [main.createInstance(), main.createInstance()].map(
      (instance) => instance.children[0]
    );
    if (first === undefined || second === undefined) {
      throw new Error("each instance holds its main's frame");
    }
    first.visible = false;
    expect([first.visible, second.visible]).toEqual([false, true]);
  });
});
