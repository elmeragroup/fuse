/**
 * A text layer drawn with a line through it, on the in-memory file in `fake-figma.ts`. Unit under
 * test: the text layer's plan through Apply and Plan (`planDecoration` in `text-layer.ts`). Oracle:
 * the Plugin API's `TextNode.textDecoration`, which takes `STRIKETHROUGH` for a line through the
 * text and `NONE` for no line, and whose offset, thickness and color read `null` on a text that is
 * not underlined.
 */
import { describe, expect, it } from "vitest";

import type { TextLayerSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, LABEL, nestedKit } from "./button-kit-fixture.ts";
import { aliasOf, childNamed, color, fixtureFile, string } from "./fake-fixtures.ts";
import { reconcileKit } from "./reconcile.ts";

/** The label with a line through it. */
const STRUCK: TextLayerSpec = { ...LABEL, strikethrough: true };

/** A synced file the Button fixture's label binds. */
function syncedFile() {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
    string("Fuse brand", "font-sans", "Roboto"),
  ]);
}

/** The label's decoration and its underline fields after the file reopens. */
async function decorationOf(file: ReturnType<typeof syncedFile>) {
  file.reopen();
  const label = childNamed(await buttonVariant(file), "TEXT", "Label");
  return [label.textDecoration, label.textDecorationThickness, label.textDecorationColor];
}

describe("a label with a line through it", () => {
  it("draws STRIKETHROUGH, and the next Plan lists nothing", async () => {
    const file = syncedFile();
    await reconcileKit(file.figma, nestedKit([STRUCK]), true);
    expect(await decorationOf(file)).toEqual(["STRIKETHROUGH", null, null]);
    expect((await reconcileKit(file.figma, nestedKit([STRUCK]), false)).changes).toEqual([]);
  });

  it("drops the line once the spec draws none", async () => {
    const file = syncedFile();
    await reconcileKit(file.figma, nestedKit([STRUCK]), true);
    file.reopen();
    await reconcileKit(file.figma, nestedKit([LABEL]), true);
    expect(await decorationOf(file)).toEqual(["NONE", null, null]);
  });

  it("turns an underline into a line through the text", async () => {
    const file = syncedFile();
    const underlined: TextLayerSpec = {
      ...LABEL,
      underline: { offset: undefined, thickness: undefined, color: undefined },
    };
    await reconcileKit(file.figma, nestedKit([underlined]), true);
    file.reopen();
    await reconcileKit(file.figma, nestedKit([STRUCK]), true);
    expect(await decorationOf(file)).toEqual(["STRIKETHROUGH", null, null]);
  });
});
