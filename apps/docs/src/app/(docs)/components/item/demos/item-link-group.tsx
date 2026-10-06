"use client";

import { Item } from "@elmeragroup/fuse/item";

/** Grouped link items: each anchor stays a link inside its own list item. */
export function ItemLinkGroup() {
  return (
    <Item.Group>
      <Item.Root variant="outline" render={<a href="#profile" />}>
        <Item.Content>
          <Item.Title>Profile</Item.Title>
          <Item.Description>Name, email and phone number.</Item.Description>
        </Item.Content>
      </Item.Root>
      <Item.Root variant="outline" render={<a href="#invoices" />}>
        <Item.Content>
          <Item.Title>Invoices</Item.Title>
          <Item.Description>Past invoices and payment status.</Item.Description>
        </Item.Content>
      </Item.Root>
      <Item.Root variant="outline" render={<a href="#notifications" />}>
        <Item.Content>
          <Item.Title>Notifications</Item.Title>
          <Item.Description>Choose which messages you receive.</Item.Description>
        </Item.Content>
      </Item.Root>
    </Item.Group>
  );
}
