/**
 * Browser project. The focus algorithms against plain rendered controls, where the expected element
 * is the one the test rendered for the role, and against shadow roots, where the root's own
 * `activeElement` is the oracle for where focus is.
 */
import { describe, expect, it, onTestFinished } from "vitest";
import { userEvent } from "vitest/browser";

import { renderOrdersInShadowRoot, settled, STATUS_THREE } from "../../../test/data-table-filter-fixture";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { focusEdge, focusMovedElsewhere, resolveFocusTarget } from "./filter-focus";

describe("resolveFocusTarget", () => {
  it("takes the control inside the marked wrapper over an earlier focusable", () => {
    renderThemed(
      <section aria-label="Editor">
        <button type="button">Back</button>
        <div data-dtf-initial-focus="">
          <input aria-label="Minimum" />
        </div>
      </section>
    );
    expect(resolveFocusTarget(roleNamed("region", "Editor"))).toBe(roleNamed("textbox", "Minimum"));
  });

  it("takes the first focusable without a mark, past a hidden input", () => {
    renderThemed(
      <section aria-label="Editor">
        <input type="hidden" />
        <button type="button">First</button>
        <button type="button">Second</button>
      </section>
    );
    expect(resolveFocusTarget(roleNamed("region", "Editor"))).toBe(roleNamed("button", "First"));
  });
});

describe("focusEdge", () => {
  it("focuses the first or last segment in document order, whatever order they registered in", () => {
    renderThemed(
      <>
        <button type="button">A</button>
        <button type="button">B</button>
        <button type="button">C</button>
      </>
    );
    const [a, b, c] = [roleNamed("button", "A"), roleNamed("button", "B"), roleNamed("button", "C")];
    const registered = new Set([c, a, b]);
    expect(focusEdge(registered, "first", null)).toBe(a);
    expect(document.activeElement).toBe(a);
    expect(focusEdge(registered, "last", null)).toBe(c);
    expect(document.activeElement).toBe(c);
  });

  it("passes a segment that cannot take focus, then falls back, then reports nothing", () => {
    renderThemed(
      <>
        <button type="button" disabled>
          Disabled
        </button>
        <button type="button">Fallback</button>
      </>
    );
    const disabled = roleNamed("button", "Disabled");
    const fallback = roleNamed("button", "Fallback");
    expect(focusEdge(new Set([disabled]), "first", fallback)).toBe(fallback);
    expect(focusEdge(new Set([disabled]), "first", null)).toBeNull();
  });
});

describe("focusMovedElsewhere across shadow roots", () => {
  it("returns focus to the chip's Value when Escape closes the editor in a closed shadow root", async () => {
    // DOM audit: locators cannot enter a closed shadow root, so the test finds the Value and the
    // popover by their slots in the root it rendered into.
    const shadow = renderOrdersInShadowRoot({ initial: STATUS_THREE }, "closed");
    const value = shadow.querySelector<HTMLElement>('[data-slot="data-table-filter-value"]');
    if (value === null) {
      throw new Error("expected the Status chip's Value");
    }
    value.click();
    await expect
      .poll(() => shadow.activeElement?.closest('[data-slot="data-table-filter-value-content"]') ?? null)
      .not.toBeNull();
    await settled();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => shadow.activeElement).toBe(value);
  });

  it("reads focus from a closed shadow root that holds the popup", () => {
    const host = document.createElement("div");
    document.body.append(host);
    onTestFinished(() => {
      host.remove();
    });
    // The document names only the host of a closed root, so a read from it sees focus outside.
    const shadow = host.attachShadow({ mode: "closed" });
    const popup = document.createElement("div");
    const inside = document.createElement("button");
    const outside = document.createElement("button");
    popup.append(inside);
    shadow.append(popup, outside);

    inside.focus();
    expect(focusMovedElsewhere(popup, [popup])).toBe(false);
    outside.focus();
    expect(focusMovedElsewhere(popup, [popup])).toBe(true);
  });

  it("counts focus inside an open shadow root nested in an owned element as staying", () => {
    const popup = document.createElement("div");
    const control = document.createElement("div");
    const outside = document.createElement("button");
    popup.append(control);
    document.body.append(popup, outside);
    onTestFinished(() => {
      popup.remove();
      outside.remove();
    });
    const input = document.createElement("input");
    control.attachShadow({ mode: "open" }).append(input);

    input.focus();
    expect(focusMovedElsewhere(popup, [popup])).toBe(false);
    outside.focus();
    expect(focusMovedElsewhere(popup, [popup])).toBe(true);
  });
});
