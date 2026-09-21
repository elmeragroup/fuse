import { expectTypeOf, test } from "vitest";

import type { Accordion as RootAccordion } from "@elmeragroup/fuse";
import { Accordion, accordionVariants } from "@elmeragroup/fuse/accordion";

test("Accordion ships from the accordion entry and the root barrel", () => {
  expectTypeOf<typeof Accordion>().toEqualTypeOf<typeof RootAccordion>();
  expectTypeOf(Accordion.Root).toBeFunction();
  expectTypeOf(Accordion.Item).toBeFunction();
  expectTypeOf(Accordion.Header).toBeFunction();
  expectTypeOf(Accordion.Trigger).toBeFunction();
  expectTypeOf(Accordion.Content).toBeFunction();
});

test("the public namespace is five parts plus the public recipe", () => {
  expectTypeOf(Accordion).not.toHaveProperty("Panel");
  expectTypeOf(Accordion).not.toHaveProperty("AccordionItem");
  expectTypeOf(Accordion).not.toHaveProperty("AccordionTrigger");
  expectTypeOf(accordionVariants).toBeFunction();
});

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

test("accordionVariants is public and returns slot functions", () => {
  expectTypeOf(accordionVariants({ variant: "card", radius: "xl" }).item()).toBeString();
  expectTypeOf(accordionVariants().contentInner()).toBeString();
});
