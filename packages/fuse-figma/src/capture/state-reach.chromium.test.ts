/**
 * Unit under test: `captureSet`'s check that each state a cell forces shows, run against Chromium.
 * Oracle: which element the page forces and which rules match it there, as the renderer's markup
 * makes them. A hover rule gated by `:not([data-selected])` leaves a selected button unstyled while
 * the page hovers that very button, so the cell draws as at rest and the capture keeps it, marked; a
 * force that lands on a sibling of the styled button shows nothing of the state, so the capture
 * refuses the set.
 */
import { createElement as h } from "react";
import type { ReactElement } from "react";

import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { CompareBrowser } from "../compare/browser-render.ts";
import type { CellRenderer } from "../compare/cell-renderers.ts";
import type { Cell } from "../components/component-spec.ts";
import { captureSet } from "./run-capture.ts";
import type { CaptureTarget } from "./run-capture.ts";

/** The page's own sheet: one hover rule, gated off a selected button. */
const ASSETS = {
  styles: "@layer utilities { .styled:not([data-selected]):hover { opacity: 0.5 } }",
  themes: "",
  preflight: "",
  fontCss: "",
  fontDirectory: "",
  fontPackage: "",
  hostCss: "",
  client: "",
};

/** A set of two forms, each at rest and hovered, whose hover lands on the `force` part. */
function target(forms: readonly string[]): CaptureTarget {
  return {
    key: "probe",
    slot: "probe",
    statePart: "force",
    axes: [
      { name: "form", values: forms },
      { name: "state", values: ["rest", "hover"] },
    ],
  };
}

/** A button the page forces, styled, and selected where the form says so. */
const button = (selected: boolean): ReactElement =>
  h("button", {
    key: "button",
    "data-slot": "force",
    className: "styled",
    style: { width: 16, height: 16 },
    "data-selected": selected ? "" : undefined,
  });

const RENDERER: CellRenderer = {
  set: "probe",
  entry: "dist/button.js",
  element: (cell: Cell) =>
    h(
      "div",
      { "data-slot": "probe", style: { width: 36, height: 36 } },
      cell.form === "wrong"
        ? [
            h("span", {
              key: "span",
              "data-slot": "force",
              style: { display: "inline-block", width: 16, height: 16 },
            }),
            h("button", { key: "button", className: "styled", style: { width: 16, height: 16 } }),
          ]
        : button(cell.form === "selected")
    ),
};

/** Capture a set of the given forms, as `figma:capture` does. */
function capture(forms: readonly string[]) {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const browser = yield* CompareBrowser.launch(ASSETS);
        return yield* Effect.result(captureSet(browser, target(forms), RENDERER));
      })
    )
  );
}

describe("a forced state no rule styles in a cell", () => {
  it("keeps a selected button's hover, marked as drawing at rest, beside a plain button's", async () => {
    const result = await capture(["plain", "selected"]);
    expect(Result.isSuccess(result)).toBe(true);
    const marked = Result.isSuccess(result)
      ? result.success.cells.filter((cell) => cell.drawsAsRest === true).map((cell) => cell.key)
      : [];
    expect(marked).toEqual(["probe/form=selected,state=hover"]);
  }, 60_000);

  it("refuses a hover the page forces on a sibling of the styled button", async () => {
    const result = await capture(["plain", "wrong"]);
    expect(Result.isFailure(result) ? result.failure._tag : "captured").toBe("StateNotReached");
  }, 60_000);
});
