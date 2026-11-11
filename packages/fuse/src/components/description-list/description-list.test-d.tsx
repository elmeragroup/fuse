import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  DescriptionListContentProps,
  DescriptionListDetailsProps,
  DescriptionListHeadingProps,
  DescriptionListItemProps,
  DescriptionListRootProps,
  DescriptionListTermProps,
} from "@elmeragroup/fuse/description-list";
import * as DescriptionListModule from "@elmeragroup/fuse/description-list";
import { DescriptionList } from "@elmeragroup/fuse/description-list";

test("public API exports only the namespace and part prop types, with native attributes, Heading render, and no as prop", () => {
  expectTypeOf<DescriptionListRootProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<DescriptionListContentProps>().toEqualTypeOf<
    ComponentProps<"dl"> & { layout?: "responsive" | "inline"; dividers?: boolean }
  >();
  expectTypeOf<DescriptionListItemProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<DescriptionListTermProps>().toEqualTypeOf<ComponentProps<"dt">>();
  expectTypeOf<DescriptionListDetailsProps>().toEqualTypeOf<ComponentProps<"dd">>();
  expectTypeOf<DescriptionListRootProps["ref"]>().toEqualTypeOf<ComponentProps<"div">["ref"]>();
  expectTypeOf<DescriptionListHeadingProps>().toHaveProperty("render");

  expectTypeOf(DescriptionListModule).not.toHaveProperty("descriptionListVariants");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionListRoot");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionListHeading");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionTerm");
  expectTypeOf(DescriptionListModule).not.toHaveProperty("DescriptionDetails");

  const _root = (
    <DescriptionList.Root className="max-w-md" id="customer">
      <DescriptionList.Heading>Customer</DescriptionList.Heading>
      <DescriptionList.Heading render={<h3 />}>Section</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Item data-testid="name">
          <DescriptionList.Term>Name</DescriptionList.Term>
          <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
  const _ref = <DescriptionList.Root ref={null} />;

  const _inline = <DescriptionList.Content layout="inline" />;
  // @ts-expect-error layout is responsive or inline
  const _badLayout = <DescriptionList.Content layout="stacked" />;
  const _noDividers = <DescriptionList.Content dividers={false} />;
  const _responsiveNoDividers = <DescriptionList.Content layout="responsive" dividers={false} />;
  // @ts-expect-error only the content takes dividers
  const _itemDividers = <DescriptionList.Item dividers={false} />;
  // @ts-expect-error dividers is a boolean
  const _dividersString = <DescriptionList.Content dividers="false" />;
  // @ts-expect-error only the content takes a layout
  const _termLayout = <DescriptionList.Term layout="inline" />;
  // @ts-expect-error only the content takes a layout
  const _itemLayout = <DescriptionList.Item layout="inline" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <DescriptionList.Root as="section" />;
});

test("consumer props extend and forward the Content props, dividers included", () => {
  // A consumer's own list props extend the Content props as an interface and forward them through
  // `Omit`, as they could before `dividers`; both need an object type, not a union. Declared inside
  // the test so the checker reports their errors here.
  // oxlint-disable-next-line typescript/consistent-type-definitions -- the interface is the consumer pattern under test: it extends only an object type, never a union
  interface SummaryListProps extends DescriptionListContentProps {
    heading: string;
  }

  function SummaryList({ heading, ...props }: SummaryListProps) {
    return (
      <DescriptionList.Root>
        <DescriptionList.Heading>{heading}</DescriptionList.Heading>
        <DescriptionList.Content {...props} />
      </DescriptionList.Root>
    );
  }

  function PlainList(props: Omit<DescriptionListContentProps, "className">) {
    return <DescriptionList.Content className="max-w-md" {...props} />;
  }

  expectTypeOf<SummaryListProps["dividers"]>().toEqualTypeOf<boolean | undefined>();
  const _summary = <SummaryList heading="Delivery" layout="responsive" dividers={false} />;
  const _plain = <PlainList layout="inline" dividers={false} />;
  const _plainDefault = <PlainList dividers />;
});
