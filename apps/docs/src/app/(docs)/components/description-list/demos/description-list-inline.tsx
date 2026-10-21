"use client";

import { Card } from "@elmeragroup/fuse/card";
import { DescriptionList } from "@elmeragroup/fuse/description-list";

/**
 * An order summary in a card: two inline lists, each term on one row with its value at the end,
 * spaced as two groups.
 */
export function DescriptionListInline() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Title size="lg">Order summary</Card.Title>
      </Card.Header>
      <Card.Content>
        <DescriptionList.Content layout="inline">
          <DescriptionList.Item>
            <DescriptionList.Term>Start date</DescriptionList.Term>
            <DescriptionList.Details>1 November 2026</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Address</DescriptionList.Term>
            <DescriptionList.Details>Storgata 1, entrance B, 3611 Kongsberg</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
        <DescriptionList.Content layout="inline">
          <DescriptionList.Item>
            <DescriptionList.Term>Electricity</DescriptionList.Term>
            <DescriptionList.Details>349 kr/month</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Monthly fee</DescriptionList.Term>
            <DescriptionList.Details>50 kr/month</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Monthly amount</DescriptionList.Term>
            <DescriptionList.Details>399 kr/month</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      </Card.Content>
    </Card.Root>
  );
}
