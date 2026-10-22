"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListBasic() {
  return (
    <DescriptionList.Root>
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
          <DescriptionList.Details>7070575000</DescriptionList.Details>
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
