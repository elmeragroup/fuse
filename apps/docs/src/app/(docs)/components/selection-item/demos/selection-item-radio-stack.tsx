"use client";

import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

export function SelectionItemRadioStack() {
  return (
    <RadioItemGroup label="Payment method" defaultValue="direct-debit">
      <RadioItem value="invoice">
        <RadioItem.Content>
          <RadioItem.Title>Invoice</RadioItem.Title>
          <RadioItem.Description>Sent by email every month.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
      <RadioItem value="direct-debit">
        <RadioItem.Content>
          <RadioItem.Title>Direct debit</RadioItem.Title>
          <RadioItem.Description>Paid from your bank account on the due date.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
      <RadioItem value="card">
        <RadioItem.Content>
          <RadioItem.Title>Card</RadioItem.Title>
          <RadioItem.Description>Charged to a saved card on the due date.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
    </RadioItemGroup>
  );
}
