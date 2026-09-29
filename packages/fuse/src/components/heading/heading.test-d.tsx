import { expectTypeOf, test } from "vitest";

import type { HeadingProps } from "@elmeragroup/fuse/heading";
import { Heading } from "@elmeragroup/fuse/heading";

test("HeadingProps is native heading props plus the recipe axes and level, and the element takes them with no polymorphic as prop", () => {
  expectTypeOf<HeadingProps["level"]>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | undefined>();
  expectTypeOf<HeadingProps["variant"]>().toEqualTypeOf<
    | "default"
    | "foreground"
    | "primary"
    | "secondary"
    | "brand"
    | "muted"
    | "inherit"
    | "destructive"
    | undefined
  >();
  expectTypeOf<HeadingProps["size"]>().toEqualTypeOf<
    "default" | "sm" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | undefined
  >();
  expectTypeOf<HeadingProps["font"]>().toEqualTypeOf<"default" | "normal" | "semi-bold" | undefined>();
  expectTypeOf<HeadingProps["align"]>().toEqualTypeOf<"left" | "center" | "right" | undefined>();
  expectTypeOf<HeadingProps["className"]>().toEqualTypeOf<string | undefined>();

  const _basic = <Heading>Order overview</Heading>;
  const _levelled = (
    <Heading level={1} size="sm" variant="muted" align="center">
      Details
    </Heading>
  );
  const _render = <Heading render={<a href="#order" />}>Order overview</Heading>;

  // @ts-expect-error level is constrained to 1-6
  const _badLevel = <Heading level={7} />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Heading as="p" />;
});
