"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListNoDividers() {
  return (
    <DescriptionList.Root>
      <DescriptionList.Heading>Delivery</DescriptionList.Heading>
      <DescriptionList.Content dividers={false}>
        <DescriptionList.Item>
          <DescriptionList.Term>Product</DescriptionList.Term>
          <DescriptionList.Details>Spot price with monthly average</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Start date</DescriptionList.Term>
          <DescriptionList.Details>1 November 2026</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Meter point</DescriptionList.Term>
          <DescriptionList.Details>707057500012345678</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
