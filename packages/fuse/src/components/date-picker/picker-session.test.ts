/*
 * Unit under test: the picker edit session's transitions (`picker-session.ts`). Expectations are
 * written out: which selection is held, for which basis, and the reset generation.
 */
import { describe, expect, it } from "vitest";

import { heldFor, hold, initialPickerSession, opened, rebase, resetPickerSession } from "./picker-session";

const PICK = { reason: "day-press", event: new Event("click"), trigger: undefined } as const;

describe("picker session", () => {
  it("holds a selection only over the basis it was made on, and drops it for good when the basis moves", () => {
    const held = hold(initialPickerSession<string>(false), {
      basis: "A",
      value: "half",
      finalizeOnClose: null,
    });
    expect(heldFor(held, "A")?.value).toBe("half");
    expect(heldFor(held, "B")).toBeNull();

    const moved = rebase(held, "B");
    expect(moved.held).toBeNull();
    // Back on A, nothing comes back.
    expect(heldFor(rebase(moved, "A"), "A")).toBeNull();
    // Rebasing on the same basis changes nothing.
    expect(rebase(held, "A")).toBe(held);
  });

  it("drops a selection the close finalizes and keeps one the inputs still show", () => {
    const open = opened(initialPickerSession<string>(false), true);
    const finalized = hold(open, { basis: "", value: "day", finalizeOnClose: PICK });
    expect(opened(finalized, false)).toEqual({ open: false, held: null, generation: 0 });

    const typed = hold(open, { basis: "", value: "start only", finalizeOnClose: null });
    expect(opened(typed, false).held?.value).toBe("start only");
  });

  it("starts a reset's generation with nothing held", () => {
    const held = hold(initialPickerSession<string>(true), { basis: "A", value: "x", finalizeOnClose: null });
    const reset = resetPickerSession(resetPickerSession(held));
    expect(reset).toEqual({ open: true, held: null, generation: 2 });
  });
});
