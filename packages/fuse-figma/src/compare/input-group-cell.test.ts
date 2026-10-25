/**
 * The HTML the built Fuse parts render for an `input-group` cell. The unit under test is the Input
 * group renderer. The oracle is the public contract of `InputGroup`, `Combobox.Input` and
 * `Command.Input` and Base UI's documented control state attributes: the group is a `<div
 * data-slot="input-group">` holding its control, an `<input data-slot="input-group-control">` with the
 * placeholder, and one addon. Combobox's addon trails the control with the caret, an
 * `input-group-button`, or with `showClear` the `combobox-clear` button, and Command's addon follows
 * the control in the DOM holding the search glyph. A disabled Combobox disables its input and its
 * buttons, and an invalid `Field.Root` marks the input `aria-invalid="true"`. The cell sits in a host
 * 384px wide, the width the kit draws.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { inputGroup } from "./input-group-cell";

/** Each element with a `data-slot`, as its name, its slot and the attributes a state shows. */
function outline(form: string, state: string) {
  const elements = elementsOf(renderCellHtml(inputGroup, { form, state }));
  return elements.flatMap((element) => {
    const slot = element.attributes.get("data-slot");
    if (slot === undefined) {
      return [];
    }
    const shown = ["placeholder", "disabled", "aria-invalid", "data-align"].flatMap((name) => {
      const value = element.attributes.get(name);
      return value === undefined ? [] : [`${name}=${value}`];
    });
    return [[element.name, slot, ...shown].join(" ")];
  });
}

describe("the Input group renderer", () => {
  it("renders Combobox's input with its caret trailing the control", () => {
    expect(outline("caret", "rest")).toEqual([
      "div input-group",
      "input input-group-control placeholder=Search…",
      "div input-group-addon data-align=inline-end",
      "button input-group-button",
    ]);
  });

  it("renders Command's search glyph in a leading addon after the control in the DOM", () => {
    const html = renderCellHtml(inputGroup, { form: "search", state: "rest" });
    expect(outline("search", "rest")).toEqual([
      "div input-group",
      "input input-group-control placeholder=Search…",
      "div input-group-addon data-align=inline-start",
    ]);
    expect(elementsOf(html).filter((element) => element.name === "svg")).toHaveLength(1);
  });

  it("renders the clear button in place of the caret beside the empty input", () => {
    expect(outline("clear", "rest")).toEqual([
      "div input-group",
      "input input-group-control placeholder=Search…",
      "div input-group-addon data-align=inline-end",
      "button combobox-clear",
    ]);
  });

  it("disables the input and the caret of a disabled cell", () => {
    expect(outline("caret", "disabled")).toEqual([
      "div input-group",
      "input input-group-control placeholder=Search… disabled=",
      "div input-group-addon data-align=inline-end",
      "button input-group-button disabled=",
    ]);
  });

  it("marks the input and the caret invalid inside an invalid Field root", () => {
    expect(outline("caret", "invalid")).toEqual([
      "div field",
      "div input-group",
      "input input-group-control placeholder=Search… aria-invalid=true",
      "div input-group-addon data-align=inline-end",
      "button input-group-button aria-invalid=true",
    ]);
  });
});
