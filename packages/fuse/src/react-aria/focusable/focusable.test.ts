import { useFocusable as useRacFocusable } from "react-aria";
import { Focusable as RacFocusable } from "react-aria-components";
import { describe, expect, it } from "vitest";

import { Focusable, useFocusable } from "./focusable";

describe("focusable re-export identity", () => {
  it("is the same function as react-aria-components Focusable and react-aria useFocusable", () => {
    expect(Focusable).toBe(RacFocusable);
    expect(useFocusable).toBe(useRacFocusable);
  });
});
