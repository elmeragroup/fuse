"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListInline() {
  return (
    <DescriptionList.Root className="max-w-sm w-full">
      <DescriptionList.Content layout="inline">
        <DescriptionList.Item>
          <DescriptionList.Term>Start date</DescriptionList.Term>
          <DescriptionList.Details>1 November 2026</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Address</DescriptionList.Term>
          <DescriptionList.Details>Storgata 1, entrance B, 3611 Kongsberg</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Monthly amount</DescriptionList.Term>
          <DescriptionList.Details>399 kr/month</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
