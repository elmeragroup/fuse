import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Input as RootInput } from "@elmeragroup/fuse";
import type { InputProps } from "@elmeragroup/fuse/input";
import { Input } from "@elmeragroup/fuse/input";

test("Input ships from the input entry and the root barrel", () => {
  expectTypeOf<typeof Input>().toEqualTypeOf<typeof RootInput>();
  expectTypeOf(Input).toBeFunction();
});

test("InputProps is the native input surface, with no recipe axis and no render prop", () => {
  expectTypeOf<InputProps>().toEqualTypeOf<ComponentProps<"input">>();

  const _text = <Input type="email" aria-label="Email" />;
  const _number = <Input type="number" aria-label="Amount" />;

  // The md rung is pinned by the shared field box, so no recipe `size` axis is grafted on:
  // `size` stays the native numeric attribute and rejects a rung name.
  // @ts-expect-error native input.size is a number, not a control-rung name
  const _noSizeAxis = <Input size="sm" />;
  // @ts-expect-error the box is not variant-axed
  const _noVariant = <Input variant="ghost" />;
  // @ts-expect-error Input takes the native element only — no useRender polymorphism
  const _noRender = <Input render={<textarea />} />;
});
