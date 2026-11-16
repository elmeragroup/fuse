"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListSeveralTerms() {
  return (
    <DescriptionList.Root className="max-w-xl w-full">
      <DescriptionList.Heading>Contact</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Item>
          <DescriptionList.Term>Phone</DescriptionList.Term>
          <DescriptionList.Term>Mobile</DescriptionList.Term>
          <DescriptionList.Details>+47 900 12 345</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Email</DescriptionList.Term>
          <DescriptionList.Details>kari@nordmann.no</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
