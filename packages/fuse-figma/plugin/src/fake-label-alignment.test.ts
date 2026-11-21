/**
 * The in-memory file's text-alignment override through a swap, rule 41 in `fake/instances.ts`. Unit
 * under test: the fake in `fake-figma.ts`, whose `overrides` the plugin reads to plan an alignment
 * the spec dropped. Oracle: probe FA1 on a real file on 2026-11-20. Variants `size=sm` and `size=lg`
 * and two plain components each held a `Label` text at LEFT, one plain component's at RIGHT. An
 * instance of `size=sm` whose label took CENTER read CENTER after `swapComponent(size=lg)`, after
 * `setProperties({ size: 'lg' })` and after `swapComponent` to each plain component, with the new
 * component's characters, and `overrides` listed the new label with `textAlignHorizontal`.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

const ROBOTO: FontName = { family: "Roboto", style: "Regular" };

/** A component holding one `Label` text of the given characters and alignment. */
function labeled(figma: PluginAPI, name: string, characters: string, align: TextNode["textAlignHorizontal"]) {
  const component = figma.createComponent();
  component.name = name;
  const label = figma.createText();
  label.name = "Label";
  label.fontName = ROBOTO;
  label.characters = characters;
  label.textAlignHorizontal = align;
  component.appendChild(label);
  return component;
}

/** FA1's file: the `size` set, the plain RIGHT and LEFT components, and an instance of `size=sm` at CENTER. */
async function fa1File() {
  const { figma } = createFakeFigma({ collections: [] });
  await figma.loadFontAsync(ROBOTO);
  const sm = labeled(figma, "size=sm", "Small", "LEFT");
  const lg = labeled(figma, "size=lg", "Large", "LEFT");
  figma.combineAsVariants([sm, lg], figma.currentPage);
  const right = labeled(figma, "Right", "Right", "RIGHT");
  const left = labeled(figma, "Left", "Left", "LEFT");
  const instance = sm.createInstance();
  labelOf(instance).textAlignHorizontal = "CENTER";
  return { sm, lg, right, left, instance };
}

/** The instance's `Label` sublayer as it stands now. */
function labelOf(instance: InstanceNode): TextNode {
  const label = instance.children[0];
  if (label?.type !== "TEXT") {
    throw new Error(`Expected the instance's first child to be a TEXT, got ${label?.type ?? "no child"}.`);
  }
  return label;
}

/** What FA1 read after a swap: the label's alignment and characters, and whether `overrides` lists it. */
function read(instance: InstanceNode) {
  const label = labelOf(instance);
  const listed = instance.overrides.some(
    ({ id, overriddenFields }) => id === label.id && overriddenFields.includes("textAlignHorizontal")
  );
  return [label.textAlignHorizontal, label.characters, listed];
}

describe("a label's alignment override through a swap", () => {
  it("stays on the new variant's label after swapComponent, as FA1 read", async () => {
    const { lg, instance } = await fa1File();
    instance.swapComponent(lg);
    expect(read(instance)).toEqual(["CENTER", "Large", true]);
  });

  it("stays on the new variant's label after a variant write, as FA1 read", async () => {
    const { instance } = await fa1File();
    instance.setProperties({ size: "lg" });
    expect(read(instance)).toEqual(["CENTER", "Large", true]);
  });

  it("stays over a plain component's RIGHT or LEFT label, as FA1 read", async () => {
    const toRight = await fa1File();
    toRight.instance.swapComponent(toRight.right);
    const toLeft = await fa1File();
    toLeft.instance.swapComponent(toLeft.left);
    expect([read(toRight.instance), read(toLeft.instance)]).toEqual([
      ["CENTER", "Right", true],
      ["CENTER", "Left", true],
    ]);
  });

  // A label that took no override shows the new component's alignment, as rule 38 has a sublayer
  // follow its main, and the swap lists no alignment override for it.
  it("leaves a label that took no override at the new component's alignment", async () => {
    const { sm, right } = await fa1File();
    const untouched = sm.createInstance();
    expect(labelOf(untouched).textAlignHorizontal).toBe("LEFT");
    untouched.swapComponent(right);
    expect(read(untouched)).toEqual(["RIGHT", "Right", false]);
  });
});
