import { expectTypeOf, test } from "vitest";

import type { KbdGroupProps, KbdProps } from "@elmeragroup/fuse/kbd";
import * as KbdModule from "@elmeragroup/fuse/kbd";
import { Kbd, KbdGroup } from "@elmeragroup/fuse/kbd";

test("Kbd and KbdGroup take native kbd props, one size, and no polymorphic as prop", () => {
  expectTypeOf<KbdProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<KbdGroupProps["aria-hidden"]>().toEqualTypeOf<boolean | "true" | "false" | undefined>();
  expectTypeOf(KbdModule).not.toHaveProperty("kbdVariants");

  const _combination = (
    <KbdGroup aria-hidden>
      <Kbd>Ctrl</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  );

  // @ts-expect-error a cap has one size
  const _sized = <Kbd size="sm">K</Kbd>;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Kbd as="span">K</Kbd>;
});
