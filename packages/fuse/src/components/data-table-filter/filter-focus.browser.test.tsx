/**
 * Browser project. The focus algorithms against plain rendered controls, where the expected element
 * is the one the test rendered for the role.
 */
import { describe, expect, it } from "vitest";

import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { focusEdge, resolveFocusTarget } from "./filter-focus";

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
