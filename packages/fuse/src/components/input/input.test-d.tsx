import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { InputProps } from "@elmeragroup/fuse/input";
import { Input } from "@elmeragroup/fuse/input";

test("InputProps is the native input surface plus the numeric filter, with no recipe axis and no render prop", () => {
  expectTypeOf<InputProps>().toEqualTypeOf<ComponentProps<"input"> & { filter?: "numeric" }>();

  const _text = <Input type="email" aria-label="Email" />;
  const _number = <Input type="number" aria-label="Amount" />;
  const _digits = <Input filter="numeric" maxLength={8} aria-label="Phone" />;

  // @ts-expect-error the filter keeps digits only; there is no other character class
  const _noOtherFilter = <Input filter="alphanumeric" />;

  // The md rung is pinned by the shared field box, so no recipe `size` axis is grafted on:
  // `size` stays the native numeric attribute and rejects a rung name.
  // @ts-expect-error native input.size is a number, not a control-rung name
  const _noSizeAxis = <Input size="sm" />;
  // @ts-expect-error the box is not variant-axed
  const _noVariant = <Input variant="ghost" />;
  // @ts-expect-error Input takes the native element only — no useRender polymorphism
  const _noRender = <Input render={<textarea />} />;
});
