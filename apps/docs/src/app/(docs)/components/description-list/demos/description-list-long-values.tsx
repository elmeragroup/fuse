"use client";

import { Card } from "@elmeragroup/fuse/card";
import { DescriptionList } from "@elmeragroup/fuse/description-list";

/**
 * The longest rows of a customer-facing order summary: a creation time with seconds, an 18-digit
 * metering point ID, an invoice line that ends in an email address, a street address and a long
 * email address. On a narrow phone at comfortable density, the email address moves under its term
 * whole, and the invoice line's address, wider than the row, moves under its term and breaks there.
 */
export function DescriptionListLongValues() {
  return (
    <Card.Root className="max-w-sm w-full">
      <Card.Header>
        <Card.Title>Order details</Card.Title>
      </Card.Header>
      <Card.Content>
        <DescriptionList.Content layout="inline">
          <DescriptionList.Item>
            <DescriptionList.Term>Order ID</DescriptionList.Term>
            <DescriptionList.Details>104857</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Created</DescriptionList.Term>
            <DescriptionList.Details>30 September 2026 at 12:31:32</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
        <DescriptionList.Content layout="inline">
          <DescriptionList.Item>
            <DescriptionList.Term>Metering point ID</DescriptionList.Term>
            <DescriptionList.Details>707057500012345678</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Meter number</DescriptionList.Term>
            <DescriptionList.Details>Obtained by SMS</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Chosen start date</DescriptionList.Term>
            <DescriptionList.Details>1 Nov 2026</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Invoice</DescriptionList.Term>
            <DescriptionList.Details>
              Emailed to kari.nordmann.hansen@nordmannholding.no
            </DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
        <DescriptionList.Content layout="inline">
          <DescriptionList.Item>
            <DescriptionList.Term>Address</DescriptionList.Term>
            <DescriptionList.Details>Kirkeveien 123 H0201, 0368 Oslo</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Email</DescriptionList.Term>
            <DescriptionList.Details>kari.nordmann.hansen@example.no</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Mobile number</DescriptionList.Term>
            <DescriptionList.Details>+47 912 34 567</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      </Card.Content>
    </Card.Root>
  );
}
