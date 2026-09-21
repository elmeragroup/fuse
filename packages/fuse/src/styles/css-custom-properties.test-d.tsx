import type { CSSProperties } from "react";

import { expectTypeOf, it } from "vitest";

it("keeps csstype's standard properties while accepting custom properties", () => {
  // Standard properties are still real (the augmentation did not replace csstype).
  expectTypeOf<CSSProperties["color"]>().not.toBeAny();
  // @ts-expect-error a misspelt standard property is still rejected
  const _typo: CSSProperties = { colr: "red" };
  // @ts-expect-error a wrong value on a standard property is still rejected
  const _wrongValue: CSSProperties = { color: 12 };
  // Custom properties accept string | number | undefined and nothing else.
  const _custom: CSSProperties = { "--gap": 2, "--width": "16rem", "--maybe": undefined };
  // @ts-expect-error boolean is not a custom-property value
  const _badCustom: CSSProperties = { "--x": true };
});
