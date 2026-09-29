import type { JSX } from "react";

import { expectTypeOf, test } from "vitest";

import type { TextProps } from "@elmeragroup/fuse/text";

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
