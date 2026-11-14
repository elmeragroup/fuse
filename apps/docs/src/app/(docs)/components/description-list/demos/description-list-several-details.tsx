"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListSeveralDetails() {
  return (
    <DescriptionList.Root className="max-w-xl w-full">
      <DescriptionList.Heading>Contact</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Item>
          <DescriptionList.Term>Name</DescriptionList.Term>
          <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
          <DescriptionList.Details>Also billed as Nordmann Drift AS</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Email</DescriptionList.Term>
          <DescriptionList.Details>kari@nordmann.no</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
