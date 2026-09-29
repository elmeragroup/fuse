import { expectTypeOf, test } from "vitest";

import type { ToggleProps } from "@elmeragroup/fuse/toggle";

test("ToggleProps is the primitive surface plus the recipe axes", () => {
  expectTypeOf<ToggleProps["variant"]>().toEqualTypeOf<"default" | "outline" | undefined>();
  expectTypeOf<ToggleProps["size"]>().toEqualTypeOf<"xs" | "sm" | "default" | "lg" | undefined>();
  expectTypeOf<ToggleProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ToggleProps["pressed"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ToggleProps["defaultPressed"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ToggleProps>().not.toHaveProperty("as");
});
