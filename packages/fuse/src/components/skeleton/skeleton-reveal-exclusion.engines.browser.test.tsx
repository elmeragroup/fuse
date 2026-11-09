/**
 * Unit under test: how SkeletonReveal keeps content on its way out of its form, in every engine,
 * since what a control with no form owner does is each engine's own. Oracles: what the form
 * submits and whether it validates, read off `FormData` and `checkValidity`, and which button the
 * engine takes as the form's default, read off `:default`.
 */
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { currentPane, slot, failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

describe("SkeletonReveal outgoing content in its form", () => {
  it("submits nothing, blocks nothing and gives the form no default button", async () => {
    // The skeleton drawn while loading holds no submit button, so the outgoing one is the only
    // submit button in the form once the refetch starts.
    const view = (loading: boolean, reference: string) => (
      <form aria-label="Payment">
        <SkeletonReveal loading={loading} label="Henter" reveal="smart">
          <div className="flex w-72 flex-col gap-2">
            <input name="reference" aria-label="Reference" defaultValue={reference} required />
            {loading ? null : <button type="submit">Pay</button>}
          </div>
        </SkeletonReveal>
      </form>
    );
    const { rerender } = renderThemed(view(false, ""));
    const form = roleNamed("form", "Payment");
    if (!(form instanceof HTMLFormElement)) throw new Error("expected a form");
    await nextFrames(2);
    // While it is the content on screen, the empty required input blocks the form, and its button
    // is the form's default.
    expect(new FormData(form).getAll("reference")).toEqual([""]);
    expect(form.checkValidity()).toBe(false);
    expect(roleNamed("button", "Pay").matches(":default")).toBe(true);

    // A refetch: under `smart` the content stays on screen through the skeleton's 150 ms hold.
    rerender(view(true, "4711"));
    const leaving = currentPane("skeleton-reveal-skeleton", slot("skeleton-reveal")).nextElementSibling;
    if (!(leaving instanceof HTMLElement)) throw new Error("expected the outgoing content pane");
    expect(leaving.hasAttribute("data-exiting")).toBe(true);
    // DOM audit: the outgoing pane is inert, so its button is out of the accessibility tree.
    const button = leaving.querySelector("button");
    if (button === null) throw new Error("expected the outgoing button");
    expect(new FormData(form).getAll("reference")).toEqual([]);
    expect(form.checkValidity()).toBe(true);
    expect(button.matches(":default")).toBe(false);
    expect(form.querySelector(":default")).toBeNull();
  });
});
