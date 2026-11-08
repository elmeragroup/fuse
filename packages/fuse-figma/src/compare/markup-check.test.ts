// Unit under test: `checkMarkup`, the diagnostics it returns for a rendering whose markup differs
// from its definition. Oracle: the `MarkupDiagnostic` contract, that `expected` is the definition's
// value and `found` the markup's, each as JSON text, written out by hand below from the hand-written
// markup: a cell whose fact says `data-disabled` holds but whose element lacks it, a resting cell
// whose element carries `disabled` anyway, a cell that renders no root at all, and an instance part
// whose in-place fact its element does not show, or which no markup could show.
import { createElement } from "react";

import { describe, expect, it } from "vitest";

import { chip } from "../../test/fixture-sets";
import type { CellRendering } from "./cell-renderers";
import { checkMarkup } from "./markup-check";

describe("the markup check's diagnostics", () => {
  it("reports a state attribute the definition requires and the markup lacks", () => {
    const disabling = chip("", { facts: new Map([["data-disabled", () => true]]) });
    const markup: CellRendering = { element: () => createElement("span", { "data-slot": "chip" }) };

    expect(checkMarkup(disabling, [{ state: "rest" }], markup)).toEqual([
      {
        rendering: "chip/state=rest",
        subject: "data-disabled",
        expected: "true",
        found: "false",
        message: "chip/state=rest: data-disabled: expected true, found false",
      },
    ]);
  });

  it("reports a state attribute the markup carries where the definition holds none", () => {
    const markup: CellRendering = {
      element: () => createElement("button", { "data-slot": "chip", disabled: true }),
    };

    expect(checkMarkup(chip(""), [{ state: "rest" }], markup)).toEqual([
      {
        rendering: "chip/state=rest",
        subject: "disabled",
        expected: "false",
        found: "true",
        message: "chip/state=rest: disabled: expected false, found true",
      },
    ]);
  });

  it("reports a missing root as counts of root elements", () => {
    const markup: CellRendering = { element: () => createElement("span") };

    expect(checkMarkup(chip(""), [{ state: "rest" }], markup)).toEqual([
      {
        rendering: "chip/state=rest",
        subject: "the chip parts",
        expected: "1",
        found: "0",
        message: "chip/state=rest: the chip parts: expected 1, found 0",
      },
    ]);
  });

  describe("of an instance part's in-place facts", () => {
    const INNER = chip("flex", { key: "inner", name: "Inner", slot: "inner" });
    const holding = (fact: string) =>
      chip("flex", {
        parts: [
          {
            kind: "instance",
            key: "inner",
            of: INNER,
            cell: () => ({ state: "rest" }),
            facts: new Map([[fact, () => true]]),
            shownIn: () => true,
          },
        ],
      });
    const markup: CellRendering = {
      element: () =>
        createElement(
          "span",
          { "data-slot": "chip" },
          createElement("span", { "data-slot": "inner", className: "flex" })
        ),
    };

    // The instance's attribute states read the in-place fact before the in-place check does.
    it("reports a state attribute the part declares in place that its element does not carry", () => {
      expect(checkMarkup(holding("data-disabled"), [{ state: "rest" }], markup)).toEqual([
        {
          rendering: "chip/state=rest",
          subject: "the instance on /(inner): data-disabled",
          expected: "true",
          found: "false",
          message: "chip/state=rest: the instance on /(inner): data-disabled: expected true, found false",
        },
      ]);
    });

    // `data-unread` is in no variant table, so no markup can show it.
    it("reports a fact no markup can show as a yes-or-no", () => {
      const subject = "the instance on /(inner): whether the markup can show the in-place fact data-unread";
      expect(checkMarkup(holding("data-unread"), [{ state: "rest" }], markup)).toEqual([
        {
          rendering: "chip/state=rest",
          subject,
          expected: "true",
          found: "false",
          message: `chip/state=rest: ${subject}: expected true, found false`,
        },
      ]);
    });
  });
});
