/**
 * The properties a fresh Apply writes to an instance a kit set holds, on the in-memory file in
 * `fake-figma.ts`. Unit under test: the instance stages of `instance-layers.ts`, through
 * `reconcileKit` on a synced file with no kit. Oracle: the kit spec, under which File upload's trigger
 * is a Button instance that sets its `Label` and leaves both icon swaps at their defaults, which its
 * main already shows; and the owner's real-file Apply of 2026-11-17 for U3.5, where writing the
 * `Start icon` swap the instance already showed replaced the nested icon with a bare `Plus`, which
 * dropped the `primary-foreground` fill Button's own variant gives its glyph and drew it white.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

describe("a fresh Apply's writes to File upload's trigger", () => {
  let file: FakeFigma;

  beforeAll(async () => {
    file = await appliedFile();
  });

  it("set only its Label, leaving the icon its main shows in place", async () => {
    const page = await kitPage(file, "page/file-upload");
    const variant = childNamed(setOn(page, "File upload dropzone"), "COMPONENT", "state=rest");
    const trigger = childNamed(variant, "INSTANCE", "button");
    const prefix = `${trigger.id} set properties `;
    const written = file.writes
      .filter((line) => line.startsWith(prefix))
      .flatMap((line) => line.slice(prefix.length).split(", "))
      .map((property) => property.replace(/#.*$/, ""));
    expect(written).toEqual(["Label"]);
  });
});

/**
 * Unit under test: the icon layers of `child-layers.ts`, through `reconcileKit` on a synced file with
 * no kit. Oracle: the plugin API's `ComponentNode.createInstance()`, whose instance has that component
 * as its main, so a swap to the same component writes nothing it does not already show.
 */
describe("a fresh Apply's new instances", () => {
  it("swap none to the component it made them from", async () => {
    const file = await appliedFile();
    const madeFrom = new Map<string, string>();
    const repeated: string[] = [];
    for (const line of file.writes) {
      const [node = "", ...words] = line.split(" ");
      const action = words.join(" ");
      if (action.startsWith("create an instance of ")) {
        madeFrom.set(node, action.slice("create an instance of ".length));
      } else if (action.startsWith("swap to ") && madeFrom.get(node) === action.slice("swap to ".length)) {
        repeated.push(line);
      }
    }
    expect(repeated).toEqual([]);
  });
});

/**
 * Unit under test: the instance stages of `instance-layers.ts`, through `reconcileKit` over File
 * upload's trigger after a designer deletes the Button variant it shows. Plan stops on the trigger's
 * label, whose font Figma cannot load, before any write. Once the font loads, Plan swaps the trigger
 * back to the variant Apply creates again, and Apply converges. Oracles: the plugin's font rule, and
 * the kit spec, under which the trigger shows Button's `variant=default, size=sm, state=rest,
 * icon=start`. The trigger's label carries a key of its own, so only a walk that reads the deleted
 * main's layers finds the label by the kit's key and stops on its font. A walk that read the
 * instance's own layers would miss it and let Plan through.
 */
describe("a Plan over File upload's trigger after a designer deletes the Button variant it shows", () => {
  it("stops on the trigger's label in a font Figma cannot load, then swaps it back and converges", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const page = await kitPage(file, "page/file-upload");
    const trigger = childNamed(
      childNamed(setOn(page, "File upload dropzone"), "COMPONENT", "state=rest"),
      "INSTANCE",
      "button"
    );
    const label = childNamed(trigger, "TEXT", "label");
    await file.figma.loadFontAsync({ family: "Gone Font", style: "Regular" });
    label.setBoundVariable("fontFamily", null);
    label.fontName = { family: "Gone Font", style: "Regular" };
    label.setSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY, "designer-label");
    (await trigger.getMainComponentAsync())?.remove();
    file.reopen({ unavailableFonts: [{ family: "Gone Font" }] });
    const before = file.writes.length;

    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(
      "File upload dropzone / state=rest / button / label needs the font Gone Font Regular, which Figma cannot load."
    );
    expect(file.writes.slice(before)).toEqual([]);

    file.reopen({ unavailableFonts: [] });
    expect((await reconcileKit(file.figma, kit, false)).changes).toContain(
      "File upload dropzone / state=rest / button: show Button variant=default, size=sm, state=rest, icon=start"
    );
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });
});
