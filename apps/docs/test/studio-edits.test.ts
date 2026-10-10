import { describe, expect, it } from "vitest";

import type { ThemeInput } from "@elmeragroup/fuse/theme";

import {
  editHistory,
  editedCount,
  guardedHistory,
  overridesFor,
  reduceEdits,
  reduceGuarded,
} from "../src/lib/studio/edits";
import type { EditAction, EditHistory, GuardedHistory, StudioDocument } from "../src/lib/studio/edits";
import { documentCycles } from "../src/lib/studio/token-values";

const ELMA = { variant: "external", brand: "elma", segment: "private" } as const satisfies ThemeInput;
const FKAS = { variant: "internal", brand: "fkas", segment: "private" } as const satisfies ThemeInput;

const EMPTY: StudioDocument = { theme: ELMA, overrides: { light: {}, dark: {}, shared: {} } };

function run(...actions: EditAction[]): EditHistory {
  return actions.reduce(reduceEdits, editHistory(EMPTY));
}

describe("set", () => {
  it("files a scheme-dependent token under the scheme being edited", () => {
    const { present } = run({ type: "set", scheme: "dark", name: "primary", value: "#ff0000" });
    expect(present.overrides).toEqual({ light: {}, dark: { primary: "#ff0000" }, shared: {} });
  });

  it("files a light-only token once for both schemes, whichever scheme is edited", () => {
    const { present } = run(
      { type: "set", scheme: "dark", name: "radius", value: "1rem" },
      { type: "set", scheme: "light", name: "font-heading", value: "Georgia, serif" }
    );
    expect(present.overrides).toEqual({
      light: {},
      dark: {},
      shared: { radius: "1rem", "font-heading": "Georgia, serif" },
    });
  });
});

describe("overridesFor", () => {
  it("gives a scheme its own edits and the light-only edits, never the other scheme's", () => {
    const { present } = run(
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      { type: "set", scheme: "dark", name: "primary", value: "#00ff00" },
      { type: "set", scheme: "light", name: "radius", value: "1rem" }
    );
    expect(overridesFor(present.overrides, "light")).toEqual({ primary: "#ff0000", radius: "1rem" });
    expect(overridesFor(present.overrides, "dark")).toEqual({ primary: "#00ff00", radius: "1rem" });
  });
});

describe("reset", () => {
  const edited: EditAction[] = [
    { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
    { type: "set", scheme: "light", name: "secondary", value: "#00ff00" },
    { type: "set", scheme: "dark", name: "primary", value: "#0000ff" },
    { type: "set", scheme: "light", name: "radius", value: "1rem" },
    { type: "set", scheme: "light", name: "border", value: "#111111" },
  ];

  it("resets one token in the edited scheme only", () => {
    const { present } = run(...edited, { type: "reset", scheme: "light", name: "primary" });
    expect(present.overrides).toEqual({
      light: { secondary: "#00ff00", border: "#111111" },
      dark: { primary: "#0000ff" },
      shared: { radius: "1rem" },
    });
  });

  it("resets a light-only token from either scheme", () => {
    const { present } = run(...edited, { type: "reset", scheme: "dark", name: "radius" });
    expect(present.overrides.shared).toEqual({});
  });

  it("resets a section's tokens in the edited scheme, with its light-only tokens", () => {
    const { present } = run(...edited, {
      type: "reset-section",
      scheme: "light",
      names: ["primary", "secondary", "radius"],
    });
    expect(present.overrides).toEqual({
      light: { border: "#111111" },
      dark: { primary: "#0000ff" },
      shared: {},
    });
  });

  it("resets every edit in both schemes and keeps the theme", () => {
    const { present } = run(...edited, { type: "theme", theme: FKAS }, { type: "reset-all" });
    expect(present).toEqual({ theme: FKAS, overrides: { light: {}, dark: {}, shared: {} } });
  });

  it("adds no undo step for a reset that changes nothing", () => {
    const before = run({ type: "set", scheme: "light", name: "primary", value: "#ff0000" });
    const after = reduceEdits(before, { type: "reset", scheme: "light", name: "secondary" });
    expect(after).toBe(before);
  });
});

describe("editedCount", () => {
  it("counts a section's edits that apply to the scheme", () => {
    const { present } = run(
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      { type: "set", scheme: "dark", name: "secondary", value: "#00ff00" },
      { type: "set", scheme: "dark", name: "radius", value: "1rem" }
    );
    const names = ["primary", "secondary", "radius"] as const;
    expect(editedCount(present.overrides, "light", names)).toBe(2);
    expect(editedCount(present.overrides, "dark", names)).toBe(2);
    expect(editedCount(present.overrides, "dark", ["primary"])).toBe(0);
  });
});

describe("theme", () => {
  it("changes the base theme and keeps every override", () => {
    const { present } = run(
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      { type: "set", scheme: "light", name: "radius", value: "1rem" },
      { type: "theme", theme: FKAS }
    );
    expect(present).toEqual({
      theme: FKAS,
      overrides: { light: { primary: "#ff0000" }, dark: {}, shared: { radius: "1rem" } },
    });
  });
});

describe("undo and redo", () => {
  it("steps back and forward through edits", () => {
    const first = { type: "set", scheme: "light", name: "primary", value: "#ff0000" } as const;
    const second = { type: "set", scheme: "light", name: "primary", value: "#00ff00" } as const;
    const undone = run(first, second, { type: "undo" });
    expect(undone.present.overrides.light).toEqual({ primary: "#ff0000" });
    expect(reduceEdits(undone, { type: "undo" }).present).toEqual(EMPTY);
    expect(reduceEdits(undone, { type: "redo" }).present.overrides.light).toEqual({ primary: "#00ff00" });
  });

  it("drops the redo branch on a new edit", () => {
    const history = run(
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      { type: "undo" },
      { type: "set", scheme: "light", name: "secondary", value: "#00ff00" }
    );
    expect(reduceEdits(history, { type: "redo" })).toBe(history);
  });

  it("is a no-op with nothing to undo or redo", () => {
    const history = editHistory(EMPTY);
    expect(reduceEdits(history, { type: "undo" })).toBe(history);
    expect(reduceEdits(history, { type: "redo" })).toBe(history);
  });

  it("undoes a whole coalesced gesture in one step", () => {
    const drag = (value: string): EditAction => ({
      type: "set",
      scheme: "light",
      name: "radius",
      value,
      coalesce: "radius-drag-1",
    });
    const history = run(
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      drag("0.5rem"),
      drag("0.75rem"),
      drag("1rem")
    );
    expect(history.present.overrides.shared).toEqual({ radius: "1rem" });
    const undone = reduceEdits(history, { type: "undo" });
    expect(undone.present.overrides).toEqual({ light: { primary: "#ff0000" }, dark: {}, shared: {} });
    expect(reduceEdits(undone, { type: "redo" }).present.overrides.shared).toEqual({ radius: "1rem" });
  });

  it("starts a new step when the gesture key changes or another edit intervenes", () => {
    const drag = (value: string, coalesce: string): EditAction => ({
      type: "set",
      scheme: "light",
      name: "radius",
      value,
      coalesce,
    });
    const history = run(drag("0.5rem", "a"), drag("1rem", "b"));
    expect(reduceEdits(history, { type: "undo" }).present.overrides.shared).toEqual({ radius: "0.5rem" });

    const interrupted = run(
      drag("0.5rem", "a"),
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      drag("1rem", "a")
    );
    expect(reduceEdits(interrupted, { type: "undo" }).present.overrides).toEqual({
      light: { primary: "#ff0000" },
      dark: {},
      shared: { radius: "0.5rem" },
    });
  });

  it("undoes a base theme change", () => {
    const history = run({ type: "theme", theme: FKAS }, { type: "undo" });
    expect(history.present.theme).toEqual(ELMA);
  });
});

describe("replace", () => {
  it("loads a document with a fresh history", () => {
    const loaded: StudioDocument = {
      theme: FKAS,
      overrides: { light: { primary: "#ff0000" }, dark: {}, shared: {} },
    };
    const history = run(
      { type: "set", scheme: "light", name: "ring", value: "#000000" },
      {
        type: "replace",
        document: loaded,
      }
    );
    expect(history.present).toEqual(loaded);
    expect(reduceEdits(history, { type: "undo" })).toBe(history);
  });
});

/**
 * Unit: `reduceGuarded` with `documentCycles`, the session's cycle invariant over the generated
 * base references. Oracle: the theme rules as written in Fuse's theme sources, pinned here. Every
 * theme declares `destructive: var(--error)`; an internal theme declares
 * `radius-button: var(--radius)`, an external one a literal.
 */
describe("the cycle invariant", () => {
  const INTERNAL = { variant: "internal", brand: "elma", segment: "private" } as const satisfies ThemeInput;

  function guarded(...actions: EditAction[]): GuardedHistory {
    return actions.reduce(
      (state: GuardedHistory, action) => reduceGuarded(state, action, documentCycles),
      guardedHistory(EMPTY)
    );
  }

  const destructiveLiteral: EditAction = {
    type: "set",
    scheme: "light",
    name: "destructive",
    value: "#ff0000",
  };
  const errorToDestructive: EditAction = {
    type: "set",
    scheme: "light",
    name: "error",
    value: "var(--destructive)",
  };

  it("refuses a reset that would restore a base alias into a cycle, and keeps the session", () => {
    const linked = guarded(destructiveLiteral, errorToDestructive);
    expect(linked.refusal).toBeUndefined();
    const reset = reduceGuarded(
      linked,
      { type: "reset", scheme: "light", name: "destructive" },
      documentCycles
    );
    expect(reset.history).toBe(linked.history);
    expect(reset.refusal?.names).toEqual(["destructive", "error"]);
  });

  it("refuses a section reset that would close the same cycle", () => {
    const linked = guarded(destructiveLiteral, errorToDestructive);
    const reset = reduceGuarded(
      linked,
      { type: "reset-section", scheme: "light", names: ["destructive"] },
      documentCycles
    );
    expect(reset.history).toBe(linked.history);
    expect(reset.refusal?.action.type).toBe("reset-section");
  });

  it("refuses an edit that closes a cycle through a base declaration", () => {
    const state = guarded({ type: "set", scheme: "dark", name: "error", value: "var(--destructive)" });
    expect(state.history.present).toEqual(EMPTY);
    expect(state.refusal?.names).toEqual(["destructive", "error"]);
  });

  it("refuses a theme change whose base declarations close a cycle with the edits", () => {
    const linked = guarded({ type: "set", scheme: "light", name: "radius", value: "var(--radius-button)" });
    expect(linked.refusal).toBeUndefined();
    const changed = reduceGuarded(linked, { type: "theme", theme: INTERNAL }, documentCycles);
    expect(changed.history.present.theme).toEqual(ELMA);
    expect(changed.refusal?.names).toEqual(["radius", "radius-button"]);
  });

  it("refuses a restored document that cycles, and admits one that does not", () => {
    const looping: StudioDocument = {
      ...EMPTY,
      overrides: { ...EMPTY.overrides, dark: { error: "var(--destructive)" } },
    };
    expect(guarded({ type: "replace", document: looping }).history.present).toEqual(EMPTY);
    const fine: StudioDocument = {
      ...EMPTY,
      overrides: { ...EMPTY.overrides, dark: { error: "var(--border)" } },
    };
    expect(guarded({ type: "replace", document: fine }).history.present).toEqual(fine);
  });

  it("clears the refusal on the next admitted transition", () => {
    const state = guarded(
      { type: "set", scheme: "dark", name: "error", value: "var(--destructive)" },
      destructiveLiteral,
      { type: "undo" }
    );
    expect(state.refusal).toBeUndefined();
    expect(state.history.present).toEqual(EMPTY);
  });
});
