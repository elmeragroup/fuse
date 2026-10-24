// Unit under test: `mountedMarkup`, the markup the markup check reads for a client cell. Oracle: the
// rule that a popup part or a row is checked in its slot's whole mounted HTML, as a static cell is
// in its renderer's whole markup, and that an open composite is checked as its measured elements,
// in order, under one root carrying the composite's `data-slot`, as its Figma frame holds its
// trigger and popup. HTML escapes `"` and `&` in a double-quoted attribute value as `&quot;` and
// `&amp;`.
import { describe, expect, it } from "vitest";

import { mountedMarkup } from "./client-markup";

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
