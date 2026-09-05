"use client";

import { DescriptionList } from "@elmeragroup/ui/description-list";

export function DescriptionListMultiDetails() {
  return (
    <DescriptionList.Root>
      <DescriptionList.Heading>Contact</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        <DescriptionList.Details>Also billed as Nordmann Drift AS</DescriptionList.Details>
        <DescriptionList.Term>Phone</DescriptionList.Term>
        <DescriptionList.Term>Mobile</DescriptionList.Term>
        <DescriptionList.Details>+47 900 12 345</DescriptionList.Details>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
