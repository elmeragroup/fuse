import type { CSSProperties } from "react";

import { describe, expect, it } from "vitest";

import { mergeStyle } from "./merge-style";

const vars: CSSProperties = { "--gap": 2 };

/** Narrow `mergeStyle`'s object-or-callback return to the callback arm for direct invocation. */
function callbackOf<State>(
  merged: CSSProperties | ((state: State) => CSSProperties)
): (state: State) => CSSProperties {
  if (!(merged instanceof Function)) {
    throw new Error("expected mergeStyle to return a state callback");
  }
  return merged;
}

describe("mergeStyle", () => {
  it("lets consumer styles win over the library vars", () => {
    const merged = mergeStyle(vars, { "--gap": 3, opacity: 0.5 });

    expect(merged).toEqual({ "--gap": 3, opacity: 0.5 });
  });

  it("returns a fresh copy of the vars when the consumer style is undefined", () => {
    const merged = mergeStyle(vars, undefined);

    expect(merged).toEqual({ "--gap": 2 });
    expect(merged).not.toBe(vars);
  });

  it("returns a callback that merges each state's styles over the vars", () => {
    const merged = callbackOf<{ disabled: boolean }>(
      mergeStyle(vars, (state) => (state.disabled ? { opacity: 0.5 } : undefined))
    );

    expect(merged({ disabled: true })).toEqual({ "--gap": 2, opacity: 0.5 });
    expect(merged({ disabled: false })).toEqual({ "--gap": 2 });
  });

  it("falls back to the vars when the callback returns undefined for a state", () => {
    const merged = callbackOf<{ disabled: boolean }>(mergeStyle(vars, () => undefined));

    expect(merged({ disabled: true })).toEqual({ "--gap": 2 });
  });
});
