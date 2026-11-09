// Unit under test: `mountedMarkup`, the markup the markup check reads for a client cell. Oracle: the
// rule that a popup part or a row is checked in its slot's whole mounted HTML, as a static cell is
// in its renderer's whole markup, and that an open composite is checked as its measured elements,
// in order, under one root carrying the composite's `data-slot`, as its Figma frame holds its
// trigger and popup. HTML escapes `"` and `&` in a double-quoted attribute value as `&quot;` and
// `&amp;`.
import { describe, expect, it } from "vitest";

import { chip } from "../../test/fixture-sets";
import { checkClientMarkup, mountedMarkup } from "./client-markup";

const MOUNTED = {
  slot: '<div style="display: contents;"><button data-slot="t">Open</button></div><div><div data-slot="p">Body</div></div>',
  measured: ['<button data-slot="t">Open</button>', '<div data-slot="p">Body</div>'],
};

describe("mountedMarkup", () => {
  it("is the slot's whole markup for a popup part or a row", () => {
    expect(mountedMarkup("p", undefined, MOUNTED)).toBe(MOUNTED.slot);
  });

  it("is the measured elements under one root with the composite's slot for an open composite", () => {
    expect(mountedMarkup("open", ["t", "p"], MOUNTED)).toBe(
      '<div data-slot="open"><button data-slot="t">Open</button><div data-slot="p">Body</div></div>'
    );
  });

  it("escapes the composite's slot as an attribute value", () => {
    expect(mountedMarkup('a"&b', ["t"], { slot: "", measured: ["<i></i>"] })).toBe(
      '<div data-slot="a&quot;&amp;b"><i></i></div>'
    );
  });
});

// Unit under test: `checkClientMarkup`, the markup check of a client cell's mounted markup. Oracle: a
// root its definition finds by its element must carry the `data-slot` its `elementSlot` names, as
// a menu row finds its `role="menuitem"` and names the slot Fuse stamps on it, and a rendering
// reports its first difference alone, so a wrong slot is the one diagnostic though the row's text
// differs too.
describe("checkClientMarkup", () => {
  const ROW = chip("", {
    element: { tag: "div", attributes: { role: "menuitem" } },
    elementSlot: () => "menu-item",
  });
  const check = (html: string) =>
    checkClientMarkup(
      ROW,
      undefined,
      { state: "rest" },
      { forcedAttributes: {} },
      { slot: html, measured: [] }
    );

  it("reports nothing for a row that carries the slot its definition names", () => {
    expect(check('<div role="menuitem" data-slot="menu-item"></div>')).toEqual([]);
  });

  it("reports a wrong data-slot as one diagnostic naming the rendering and both slots", () => {
    expect(check('<div role="menuitem" data-slot="menu-row">Stray</div>')).toEqual([
      {
        rendering: "chip/state=rest",
        subject: "the root's data-slot",
        expected: '"menu-item"',
        found: '"menu-row"',
        message: 'chip/state=rest: the root\'s data-slot: expected "menu-item", found "menu-row"',
      },
    ]);
  });

  // A missing attribute is no value, which the diagnostic writes as JSON `null`, so `found` parses.
  it("reports a row without a data-slot with null as the slot it found", () => {
    expect(check('<div role="menuitem"></div>')).toEqual([
      {
        rendering: "chip/state=rest",
        subject: "the root's data-slot",
        expected: '"menu-item"',
        found: "null",
        message: 'chip/state=rest: the root\'s data-slot: expected "menu-item", found null',
      },
    ]);
  });

  it("reports the stray text once the slot holds, which the wrong slot's diagnostic stood before", () => {
    expect(
      check('<div role="menuitem" data-slot="menu-item">Stray</div>').map(({ subject }) => subject)
    ).toEqual(["the label"]);
  });
});
