import { runInNewContext } from "node:vm";
import { assert, describe, it } from "vitest";

import { deepFrozen } from "../plugin/test-support/frozen.ts";

describe("deepFrozen", () => {
  it("freezes what a shallow-frozen object reaches", () => {
    const child = { n: 0 };
    deepFrozen(Object.freeze({ child }));
    assert.isTrue(Object.isFrozen(child));
  });

  // Under the `vmForks` pool the kit the run's setup wrote deserializes in another realm.
  it("freezes an object from another realm and what its fields, maps and sets reach", () => {
    const child = { n: 0 };
    const keyed = { n: 0 };
    const member = { n: 0 };
    const foreign: unknown = runInNewContext(
      "({ child, byKey: new Map([['k', keyed]]), members: new Set([member]) })",
      { child, keyed, member }
    );
    assert.isFalse(foreign instanceof Object, "the value comes from another realm");
    deepFrozen(foreign);
    assert.isTrue(Object.isFrozen(foreign));
    assert.isTrue(Object.isFrozen(child));
    assert.isTrue(Object.isFrozen(keyed));
    assert.isTrue(Object.isFrozen(member));
  });
});
