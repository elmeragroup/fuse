"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListDemo() {
  return (
    <DescriptionList.Root className="max-w-xl w-full">
      <DescriptionList.Heading>Customer</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Item>
          <DescriptionList.Term>Name</DescriptionList.Term>
          <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Customer number</DescriptionList.Term>
          <DescriptionList.Details>10492831</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Meter point</DescriptionList.Term>
          <DescriptionList.Details>707057500012345678</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Address</DescriptionList.Term>
          <DescriptionList.Details>Storgata 1, 3611 Kongsberg</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Grid company</DescriptionList.Term>
          <DescriptionList.Details>Skagerak Nett</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
