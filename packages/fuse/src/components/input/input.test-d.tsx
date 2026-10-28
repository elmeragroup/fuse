import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { InputProps } from "@elmeragroup/fuse/input";
import { Input } from "@elmeragroup/fuse/input";

test("InputProps is the native input surface plus the numeric filter and the field size, with no render prop", () => {
  expectTypeOf<InputProps>().toEqualTypeOf<
    Omit<ComponentProps<"input"> & { filter?: "numeric" }, "size"> & { size?: "sm" | "default" }
  >();

  const _text = <Input type="email" aria-label="Email" />;
  const _number = <Input type="number" aria-label="Amount" />;
  const _digits = <Input filter="numeric" maxLength={8} aria-label="Phone" />;

  // @ts-expect-error the filter keeps digits only; there is no other character class
  const _noOtherFilter = <Input filter="alphanumeric" />;

  // `size` is the field size, which replaces the native numeric attribute.
  const _sm = <Input size="sm" aria-label="Search" />;
  // @ts-expect-error the native numeric size attribute is gone
  const _noNativeSize = <Input size={20} />;
  // @ts-expect-error the field size has no md or lg name; `"default"` is the md control size
  const _noRungName = <Input size="md" />;
  // @ts-expect-error the box is not variant-axed
  const _noVariant = <Input variant="ghost" />;
  // @ts-expect-error Input takes the native element only — no useRender polymorphism
  const _noRender = <Input render={<textarea />} />;
});
