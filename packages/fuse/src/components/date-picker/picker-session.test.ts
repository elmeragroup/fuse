/*
 * Unit under test: the picker edit session's transitions, in `picker-session.ts`. Expectations are
 * written out: the committed value, which selection is held, for which basis, and the reset
 * generation.
 */
import { describe, expect, it } from "vitest";

import {
  commit,
  commitHolding,
  committedNow,
  follow,
  heldFor,
  hold,
  initialPickerSession,
  opened,
  resetPickerSession,
  settle,
} from "./picker-session";

const PICK = { reason: "day-press", event: new Event("click"), trigger: undefined } as const;

/** A session over the committed value `basis`, whose value is its key. */
function sessionOver(basis: string, open = false) {
  return initialPickerSession<string, string>(open, { value: basis, basis });
}

describe("picker session", () => {
  it("holds a selection only over the basis it was made on, and drops it for good when the value moves", () => {
    const held = hold(sessionOver("A"), "half", null);
    expect(heldFor(held, "A")?.value).toBe("half");
    expect(heldFor(held, "B")).toBeNull();

    const moved = follow(held, { value: "B", basis: "B" });
    expect(moved).toMatchObject({ value: "B", basis: "B", held: null });
    // Back on A, nothing comes back.
    expect(heldFor(follow(moved, { value: "A", basis: "A" }), "A")).toBeNull();
    // Following the same basis changes nothing.
    expect(follow(held, { value: "A", basis: "A" })).toBe(held);
  });

  it("applies the picker's own commit at once and leaves a parent's to the parent", () => {
    const held = hold(sessionOver("A"), "half", null);
    expect(commit(held, { value: "B", basis: "B" }, "picker")).toMatchObject({ value: "B", held: null });

    // A parent's commit is pending, so the next gesture builds on it and the committed value stays.
    const parents = commit(held, { value: "B", basis: "B" }, "parent");
    expect(parents).toMatchObject({ value: "A", basis: "A", held: { basis: "A", value: "half" } });
    expect(committedNow(parents)).toEqual({ value: "B", basis: "B" });
    // A render that declines it, or the end of its task, leaves the session as it was.
    expect(follow(parents, { value: "A", basis: "A" })).toEqual(held);
    expect(settle(parents)).toEqual(held);
    expect(committedNow(settle(parents))).toEqual({ value: "A", basis: "A" });
    // A render that takes it moves the session on.
    expect(follow(parents, { value: "B", basis: "B" })).toMatchObject({
      value: "B",
      pending: null,
      held: null,
    });
  });

  it("holds what a commit leaves over the value committed, whoever applies it", () => {
    const whole = sessionOver("A..B");
    const own = commitHolding(whole, { value: "..", basis: ".." }, "picker", "A..");
    expect(own).toEqual({
      open: false,
      value: "..",
      basis: "..",
      pending: null,
      held: { basis: "..", value: "A..", finalizeOnClose: null },
      generation: 0,
    });

    const parents = commitHolding(whole, { value: "..", basis: ".." }, "parent", "A..");
    expect(parents.value).toBe("A..B");
    // The selection shows once the parent renders the empty range, never over the range it still
    // passes.
    expect(heldFor(parents, "A..B")).toBeNull();
    expect(heldFor(follow(parents, { value: "..", basis: ".." }), "..")?.value).toBe("A..");
  });

  it("drops a selection the close finalizes and keeps one the inputs still show", () => {
    const open = opened(sessionOver(""), true);
    const finalized = hold(open, "day", PICK);
    expect(opened(finalized, false)).toEqual({
      open: false,
      value: "",
      basis: "",
      pending: null,
      held: null,
      generation: 0,
    });

    const typed = hold(open, "start only", null);
    expect(opened(typed, false).held?.value).toBe("start only");
  });

  it("starts a reset's generation on the value it puts back, with nothing held", () => {
    const held = hold(sessionOver("A", true), "x", null);
    const reset = resetPickerSession(resetPickerSession(held, { value: "D", basis: "D" }), {
      value: "D",
      basis: "D",
    });
    expect(reset).toEqual({ open: true, value: "D", basis: "D", pending: null, held: null, generation: 2 });
  });
});
