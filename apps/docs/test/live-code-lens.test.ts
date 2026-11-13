import { describe, expect, it } from "vitest";

import { lensMembers } from "../src/components/live-code/lens";
import type { PartSchema } from "../src/lib/live-code/schema";
import { LiveCodeStore } from "../src/lib/live-code/store";
import type { LiveSite } from "../src/lib/live-code/store";

/** A part that carries parts, as `RadioItem` carries `RadioItem.Title`. */
function Item(): null {
  return null;
}
function Title(): null {
  return null;
}
function WrappedTitle(): null {
  return null;
}
const Part = Object.assign(Item, { Title, useHelper: () => 1 });

describe("Live code namespace bindings", () => {
  it("keeps a component's own members on its stand-in, replaces the wrapped ones, and leaves the original alone", () => {
    const bound = lensMembers(Part, Part, { Title: WrappedTitle });
    expect(bound).toBeTypeOf("function");
    expect(bound).not.toBe(Part);
    expect(bound.Title).toBe(WrappedTitle);
    expect(Part.Title).toBe(Title);
    // Every other member comes along, so a demo reaching it through the binding still finds it.
    expect(bound.useHelper).toBe(Part.useHelper);
  });

  it("rebuilds a plain namespace as a fresh object with its other parts", () => {
    const namespace = { Root: Item, Title };
    const bound = lensMembers(namespace, namespace, { Title: WrappedTitle });
    expect(bound).toEqual({ Root: Item, Title: WrappedTitle });
    expect(namespace.Title).toBe(Title);
  });

  it("shows a site's value when its instances agree, and mixed where they differ", async () => {
    const schema: PartSchema = [
      { name: "isPending", kind: "boolean" },
      { name: "size", kind: "enum", values: ["sm", "lg"] },
    ];
    const store = new LiveCodeStore();
    const rendered = (isPending: boolean, size: string) => ({
      loc: "4:7",
      part: "Button",
      schema,
      values: new Map<string, string | boolean | undefined>([
        ["isPending", isPending],
        ["size", size],
      ]),
    });
    const a = Symbol("a");
    const b = Symbol("b");
    store.register(a, rendered(true, "sm"));
    store.register(b, rendered(true, "lg"));
    // Registrations land in commit and publish together on the next microtask.
    await Promise.resolve();
    const values = store.getSites().get("4:7")?.values;
    expect(values?.get("isPending")).toEqual({ kind: "one", value: true });
    expect(values?.get("size")).toEqual({ kind: "mixed" });
    store.unregister(b);
    await Promise.resolve();
    expect(store.getSites().get("4:7")?.values.get("size")).toEqual({ kind: "one", value: "sm" });
  });

  it("keeps a site that unmounted before any read, with its baseline, under the edits", () => {
    // Oracle: a dropdown item that rendered `disabled={false}`, then unmounted when the menu
    // closed, before anything read the sites.
    const schema: PartSchema = [{ name: "disabled", kind: "boolean" }];
    const store = new LiveCodeStore();
    const item = Symbol("item");
    store.register(item, { loc: "5:5", part: "Item", schema, values: new Map([["disabled", false]]) });
    store.unregister(item);
    const site = (): LiveSite | undefined => store.getSites().get("5:5");
    expect(site()?.values.get("disabled")).toEqual({ kind: "one", value: false });
    // The editor's rows read the committed edit, and Reset's clear drops it, with every other
    // site's, and shows the baseline again.
    store.set("5:5", "disabled", true);
    store.set("9:3", "variant", "outline");
    expect(site()?.values.get("disabled")).toEqual({ kind: "one", value: true });
    store.clear();
    expect(site()?.values.get("disabled")).toEqual({ kind: "one", value: false });
    expect(store.getEdits().size).toBe(0);
  });

  it("reverts an unsettled edit or preview when the stage throws, names it, and leaves a settled one alone", () => {
    const store = new LiveCodeStore();
    store.set("3:5", "granularity", "day");
    store.settle();
    store.set("3:5", "granularity", "hour");
    expect(store.rejectUnsettled()).toBe(true);
    // The edit goes back to what the stage last rendered, and the notice names the value.
    expect(store.editsAt("3:5").get("granularity")).toBe("day");
    expect(store.getNotice()).toBe('granularity="hour" doesn\'t render in this example.');
    // With nothing unsettled, a throw is the demo's own.
    expect(store.rejectUnsettled()).toBe(false);
    // A preview that throws is dropped, never committed, and named the same way.
    store.preview({ loc: "3:5", prop: "granularity", value: "minute" });
    expect(store.rejectUnsettled()).toBe(true);
    expect(store.previewAt("3:5")).toBeNull();
    expect(store.editsAt("3:5").get("granularity")).toBe("day");
    expect(store.getNotice()).toBe('granularity="minute" doesn\'t render in this example.');
    // Committing the previewed value replaces the preview in the same step, and a throw then
    // reverts the committed value.
    store.preview({ loc: "3:5", prop: "granularity", value: "hour" });
    store.set("3:5", "granularity", "hour");
    expect(store.previewAt("3:5")).toBeNull();
    expect(store.rejectUnsettled()).toBe(true);
    expect(store.editsAt("3:5").get("granularity")).toBe("day");
    const generation = store.getGeneration();
    store.reset();
    expect(store.getNotice()).toBeNull();
    expect(store.getEdits().size).toBe(0);
    expect(store.getGeneration()).toBe(generation + 1);
  });
});
