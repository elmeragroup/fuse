import { expectTypeOf, test } from "vitest";

import type { Span as RootSpan, SpanProps as RootSpanProps } from "@elmeragroup/ui";
import type { SpanProps } from "@elmeragroup/ui/span";
import { Span, spanVariants } from "@elmeragroup/ui/span";

test("Span and SpanProps ship from the span entry and the root barrel", () => {
  expectTypeOf<typeof Span>().toEqualTypeOf<typeof RootSpan>();
  expectTypeOf<SpanProps>().toEqualTypeOf<RootSpanProps>();
  expectTypeOf(Span).toBeFunction();
});

test("SpanProps is native span props plus the recipe axes and render", () => {
  expectTypeOf<SpanProps["variant"]>().toEqualTypeOf<
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
  expectTypeOf<SpanProps["size"]>().toEqualTypeOf<
    "xs" | "sm" | "default" | "lg" | "xl" | "2xl" | undefined
  >();
  expectTypeOf<SpanProps["leading"]>().toEqualTypeOf<
    "none" | "tight" | "snug" | "relaxed" | "loose" | undefined
  >();
  expectTypeOf<SpanProps["weight"]>().toEqualTypeOf<"normal" | "medium" | "bold" | undefined>();
  expectTypeOf<SpanProps["align"]>().toEqualTypeOf<"left" | "center" | "right" | "justify" | undefined>();
  expectTypeOf<SpanProps["truncate"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SpanProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SpanProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SpanProps>().not.toHaveProperty("slot");
  expectTypeOf<SpanProps>().not.toHaveProperty("as");
  expectTypeOf<SpanProps>().not.toHaveProperty("elementType");
});

test("spanVariants is public and returns a class string", () => {
  expectTypeOf(spanVariants).toBeFunction();
  expectTypeOf(spanVariants({ variant: "destructive", size: "xs", align: "center" })).toBeString();
  expectTypeOf(spanVariants()).toBeString();
});

test("the element takes the public props, render, and no as, slot, or elementType", () => {
  const _basic = <Span>4 of 12</Span>;
  const _styled = (
    <Span size="sm" variant="muted" align="right" weight="bold" leading="tight" truncate>
      Truncated
    </Span>
  );
  const _render = <Span render={<strong />}>As strong</Span>;

  // @ts-expect-error the RAC slot prop is dropped
  const _noSlot = <Span slot="description">Described</Span>;
  // @ts-expect-error the forced-span identity keeps no elementType prop
  const _noElementType = <Span elementType="p">Block</Span>;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Span as="p">Block</Span>;
  // @ts-expect-error `error` is not a variant value; the consumer-compat name is `destructive`
  const _badVariant = <Span variant="error" />;
});
