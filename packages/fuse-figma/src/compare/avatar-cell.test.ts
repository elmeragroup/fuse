/**
 * The HTML the built Fuse Avatar renders for a cell. The unit under test is the Avatar renderer. The
 * oracle is Avatar's public contract, Base UI's avatar markup and the checked-in portrait: a
 * `<span data-slot="avatar">` that carries the docs demo's size class and holds either the
 * `<span data-slot="avatar-fallback">` with the initials `AL`, or one `<img data-slot="avatar-image">`
 * with an empty `alt`, whose `src` is the portrait PNG as a data URI.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { avatar } from "./avatar-cell";
import { renderCellHtml } from "./cell-renderers";

const PORTRAIT_URI = `data:image/png;base64,${readFileSync(
  new URL("../components/avatar-portrait.png", import.meta.url)
).toString("base64")}`;

describe("the Avatar renderer", () => {
  it.each([
    ["32", "size-8"],
    ["24", "size-6"],
    ["40", "size-10"],
    ["48", "size-12"],
  ])("renders the %spx fallback as the initials in a circle with the demo's %s", (size, sizeClass) => {
    const elements = elementsOf(renderCellHtml(avatar, { content: "fallback", size }));
    expect(
      elements.map((element) => [
        element.name,
        element.attributes.get("data-slot"),
        element.text,
        element.parent,
      ])
    ).toEqual([
      ["span", "avatar", "", undefined],
      ["span", "avatar-fallback", "AL", 0],
    ]);
    expect(elements[0]?.attributes.get("class")?.split(" ")).toContain(sizeClass);
  });

  it("renders the image cell as the portrait's img alone in the circle", () => {
    const elements = elementsOf(renderCellHtml(avatar, { content: "image", size: "48" }));
    expect(
      elements.map((element) => [element.name, element.attributes.get("data-slot"), element.parent])
    ).toEqual([
      ["span", "avatar", undefined],
      ["img", "avatar-image", 0],
    ]);
    const image = elements[1]?.attributes;
    expect([image?.get("src"), image?.get("alt")]).toEqual([PORTRAIT_URI, ""]);
    expect(elements[0]?.attributes.get("class")?.split(" ")).toContain("size-12");
  });
});
