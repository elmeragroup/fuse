"use client";

import { Card } from "@elmeragroup/fuse/card";
import { DescriptionList } from "@elmeragroup/fuse/description-list";

/**
 * A phone-width order card whose rows differ in width. Each Item shares its own row between its
 * term and details: a long term wraps beside a short value, and a value too wide to sit beside its
 * term moves under it, unbroken. An Item carries attributes such as a test id.
 */
export function DescriptionListInlineRows() {
  return (
    <Card.Root className="max-w-xs w-full">
      <Card.Header>
        <Card.Title>Your order</Card.Title>
      </Card.Header>
      <Card.Content>
        <DescriptionList.Content layout="inline">
          <DescriptionList.Item data-testid="order-created">
            <DescriptionList.Term>Created</DescriptionList.Term>
            <DescriptionList.Details>21 October 2026 at 12:31</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Chosen start date</DescriptionList.Term>
            <DescriptionList.Details>28 October 2026</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Keep your existing phone number</DescriptionList.Term>
            <DescriptionList.Details>Yes</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Email</DescriptionList.Term>
            <DescriptionList.Details>kari.nordmann.invoices@example.com</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Invoice</DescriptionList.Term>
            <DescriptionList.Details>eFaktura in your online bank</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      </Card.Content>
    </Card.Root>
  );
}
