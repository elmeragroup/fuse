import { assert, describe, it } from "vitest";

import { deepFrozen } from "./frozen.ts";

describe("deepFrozen", () => {
  it("freezes what a shallow-frozen object reaches", () => {
    const child = { n: 0 };
    deepFrozen(Object.freeze({ child }));
    assert.isTrue(Object.isFrozen(child));
  });
});
