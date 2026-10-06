import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Plus } from "@elmeragroup/fuse/icons";

test("Root takes the array value shape, multiple, and recipe axes — never radix type or collapsible", () => {
  expectTypeOf<Parameters<typeof Accordion.Root>[0]["multiple"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<Parameters<typeof Accordion.Root>[0]["variant"]>().toEqualTypeOf<
    "default" | "card" | "infodropdown" | undefined
  >();
  expectTypeOf<Parameters<typeof Accordion.Root>[0]["radius"]>().toEqualTypeOf<
    "none" | "lg" | "xl" | undefined
  >();
  expectTypeOf<Parameters<typeof Accordion.Root>[0]>().not.toHaveProperty("type");
  expectTypeOf<Parameters<typeof Accordion.Root>[0]>().not.toHaveProperty("collapsible");
  expectTypeOf<Parameters<typeof Accordion.Root>[0]>().not.toHaveProperty("as");

  const _tree = (
    <Accordion.Root variant="card" radius="lg" multiple defaultValue={["shipping"]} value={["shipping"]}>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Delivered within 3–5 business days.</Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );

  const _heading = (
    <Accordion.Root>
      <Accordion.Item value="shipping">
        <Accordion.Header render={<h2 />}>
          <Accordion.Trigger nativeButton>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content keepMounted hiddenUntilFound>
          Body
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );

  const _onValueChange = (
    <Accordion.Root
      value={["shipping"]}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<string[]>();
      }}
    />
  );

  // @ts-expect-error radix type is not part of the public API
  const _noType = <Accordion.Root type="single" />;
  // @ts-expect-error radix collapsible is dropped
  const _noCollapsible = <Accordion.Root collapsible />;
  // @ts-expect-error ghost is not an accordion variant
  const _badVariant = <Accordion.Root variant="ghost" />;
  // @ts-expect-error radii are none | lg | xl only
  const _badRadius = <Accordion.Root radius="md" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Accordion.Trigger as="div" />;
});

test("Trigger takes an optional ReactNode indicator, including null", () => {
  expectTypeOf<Parameters<typeof Accordion.Trigger>[0]["indicator"]>().toEqualTypeOf<ReactNode | undefined>();

  const _none = <Accordion.Trigger indicator={null}>Shipping</Accordion.Trigger>;
  const _custom = <Accordion.Trigger indicator={<Plus />}>Shipping</Accordion.Trigger>;
  const _default = <Accordion.Trigger>Shipping</Accordion.Trigger>;
});
