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

import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { appliedFile, kitPage, setOn } from "./kit-fixture.ts";

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
