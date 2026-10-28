/**
 * The HTML the built Fuse FileUpload renders for a cell. The unit under test is the File upload
 * dropzone renderer. The oracle is FileUpload's public contract and the docs Compact demo: the Root
 * holds the dropzone, `data-slot="file-upload-dropzone"`, around the trigger, a small Button with
 * `Add files`, and the description; a disabled Root marks the zone `data-disabled` and disables the
 * trigger; the zone carries `data-drop-target` while a file drag is over it.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { fileUploadDropzone } from "./file-upload-cell";

/** The zone's state attributes and its trigger's, for one cell. */
function states(state: string) {
  const elements = elementsOf(renderCellHtml(fileUploadDropzone, { state }));
  const zone = elements.find((element) => element.attributes.get("data-slot") === "file-upload-dropzone");
  const trigger = elements.find((element) => element.attributes.get("data-slot") === "file-upload-trigger");
  return [
    ["data-drop-target", "data-disabled"].filter((name) => zone?.attributes.has(name) === true),
    ["disabled"].filter((name) => trigger?.attributes.has(name) === true),
  ];
}

describe("the File upload dropzone renderer", () => {
  it("renders the Compact demo in a host 512px wide, the trigger a small Button", () => {
    const elements = elementsOf(renderCellHtml(fileUploadDropzone, { state: "rest" }));
    const trigger = elements.find((element) => element.attributes.get("data-slot") === "file-upload-trigger");
    expect([
      elements[0]?.attributes.get("style"),
      trigger?.name,
      trigger?.attributes.get("data-size"),
      elements.some((element) => element.attributes.get("data-slot") === "file-upload-description"),
    ]).toEqual(["width:512px", "button", "sm", true]);
  });

  it("marks the zone a drop target, or disabled with its trigger, and nothing at rest", () => {
    expect(["rest", "drop-target", "disabled"].map(states)).toEqual([
      [[], []],
      [["data-drop-target"], []],
      [["data-disabled"], ["disabled"]],
    ]);
  });
});
