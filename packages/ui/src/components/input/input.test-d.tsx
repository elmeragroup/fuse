import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Input as RootInput } from "@elmeragroup/ui";
import type { InputProps } from "@elmeragroup/ui/input";
import { Input } from "@elmeragroup/ui/input";

test("Input ships from the input entry and the root barrel", () => {
  expectTypeOf<typeof Input>().toEqualTypeOf<typeof RootInput>();
  expectTypeOf(Input).toBeFunction();
});

test("InputProps is the native input surface, with no recipe axis and no render prop", () => {
  expectTypeOf<InputProps>().toEqualTypeOf<ComponentProps<"input">>();
  expectTypeOf<InputProps["type"]>().toEqualTypeOf<ComponentProps<"input">["type"]>();

  const _text = <Input type="email" aria-label="Email" />;
  const _number = <Input type="number" aria-label="Amount" />;

  // @ts-expect-error the md rung is pinned by the shared field box; there is no size axis
  const _noSize = <Input size="sm" />;
  // @ts-expect-error the box is not variant-axed (input.md §4)
  const _noVariant = <Input variant="ghost" />;
  // @ts-expect-error Input takes the native element only — no useRender polymorphism
  const _noRender = <Input render={<textarea />} />;
});
