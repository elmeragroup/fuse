import type { JSX } from "react";

import { expectTypeOf, test } from "vitest";

import type { Text as RootText, TextProps as RootTextProps } from "@elmeragroup/fuse";
import type { TextProps } from "@elmeragroup/fuse/text";
import { Text, textVariants } from "@elmeragroup/fuse/text";

test("Text and TextProps ship from the text entry and the root barrel", () => {
  expectTypeOf<typeof Text>().toEqualTypeOf<typeof RootText>();
  expectTypeOf<TextProps>().toEqualTypeOf<RootTextProps>();
  expectTypeOf(Text).toBeFunction();
});

test("TextProps is native p props plus the recipe axes, elementType, and render", () => {
  expectTypeOf<TextProps["variant"]>().toEqualTypeOf<
    | "default"
    | "foreground"
    | "primary"
    | "secondary"
    | "brand"
    | "muted"
    | "inherit"
    | "destructive"
    | "success"
    | undefined
  >();
  expectTypeOf<TextProps["size"]>().toEqualTypeOf<
    "xs" | "sm" | "default" | "lg" | "xl" | "2xl" | undefined
  >();
  expectTypeOf<TextProps["leading"]>().toEqualTypeOf<
    "none" | "tight" | "snug" | "relaxed" | "loose" | undefined
  >();
  expectTypeOf<TextProps["weight"]>().toEqualTypeOf<"normal" | "medium" | "bold" | undefined>();
  expectTypeOf<TextProps["align"]>().toEqualTypeOf<"left" | "center" | "right" | "justify" | undefined>();
  expectTypeOf<TextProps["truncate"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextProps["elementType"]>().toEqualTypeOf<keyof JSX.IntrinsicElements | undefined>();
  expectTypeOf<TextProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextProps>().not.toHaveProperty("slot");
  expectTypeOf<TextProps>().not.toHaveProperty("as");
});

test("textVariants is public and returns a class string", () => {
  expectTypeOf(textVariants).toBeFunction();
  expectTypeOf(textVariants({ variant: "destructive", size: "sm", align: "center" })).toBeString();
  expectTypeOf(textVariants()).toBeString();
});

test("the element takes the public props, render, and no as or slot", () => {
  const _basic = <Text>Body copy.</Text>;
  const _span = (
    <Text elementType="span" size="lg" variant="muted">
      Inline.
    </Text>
  );
  const _aligned = (
    <Text align="center" weight="bold" leading="tight" truncate>
      Truncated
    </Text>
  );
  const _render = <Text render={<span />}>As a span</Text>;

  // @ts-expect-error the RAC slot prop is dropped
  const _noSlot = <Text slot="description">Described</Text>;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Text as="span">Inline</Text>;
  // @ts-expect-error `error` is not a variant value; the consumer-compat name is `destructive`
  const _badVariant = <Text variant="error" />;
});
