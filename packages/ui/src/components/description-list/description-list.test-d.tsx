import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { DescriptionList as RootDescriptionList } from "@elmeragroup/ui";
import type {
  DescriptionListContentProps,
  DescriptionListDetailsProps,
  DescriptionListHeadingProps,
  DescriptionListRootProps,
  DescriptionListTermProps,
} from "@elmeragroup/ui/description-list";
import * as DescriptionListModule from "@elmeragroup/ui/description-list";
import { DescriptionList } from "@elmeragroup/ui/description-list";

test("the namespace ships all five parts from the description-list entry and the root barrel", () => {
  expectTypeOf<typeof DescriptionList>().toEqualTypeOf<typeof RootDescriptionList>();
  expectTypeOf(DescriptionList).toHaveProperty("Root");
  expectTypeOf(DescriptionList).toHaveProperty("Heading");
  expectTypeOf(DescriptionList).toHaveProperty("Content");
  expectTypeOf(DescriptionList).toHaveProperty("Term");
  expectTypeOf(DescriptionList).toHaveProperty("Details");
});

test("public API exports only the namespace and part prop types", () => {
  expectTypeOf<DescriptionListRootProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<DescriptionListContentProps>().toEqualTypeOf<ComponentProps<"dl">>();
  expectTypeOf<DescriptionListTermProps>().toEqualTypeOf<ComponentProps<"dt">>();
  expectTypeOf<DescriptionListDetailsProps>().toEqualTypeOf<ComponentProps<"dd">>();
  expectTypeOf<DescriptionListRootProps["ref"]>().toEqualTypeOf<ComponentProps<"div">["ref"]>();
  expectTypeOf<DescriptionListHeadingProps>().toHaveProperty("render");

  expectTypeOf(DescriptionListModule).not.toHaveProperty("descriptionListVariants");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionListRoot");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionListHeading");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionTerm");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionDetails");
});

test("parts take native attributes, Heading render, and no polymorphic as prop", () => {
  const _root = (
    <DescriptionList.Root className="max-w-md" id="customer">
      <DescriptionList.Heading>Customer</DescriptionList.Heading>
      <DescriptionList.Heading render={<h3 />}>Section</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
  const _ref = <DescriptionList.Root ref={null} />;

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <DescriptionList.Root as="section" />;
});
