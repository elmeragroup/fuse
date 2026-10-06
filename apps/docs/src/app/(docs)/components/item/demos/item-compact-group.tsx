"use client";

import { Item } from "@elmeragroup/fuse/item";

/** A compact group: outline rows joined into one bordered list, links included. */
export function ItemCompactGroup() {
  return (
    <Item.Group variant="compact">
      <Item.Root variant="outline" render={<a href="#profile" />}>
        <Item.Title>Profile</Item.Title>
      </Item.Root>
      <Item.Root variant="outline" render={<a href="#invoices" />}>
        <Item.Title>Invoices</Item.Title>
      </Item.Root>
      <Item.Root variant="outline" size="sm">
        <Item.Content>
          <Item.Title>Notifications</Item.Title>
          <Item.Description>Choose which messages you receive.</Item.Description>
        </Item.Content>
      </Item.Root>
    </Item.Group>
  );
}
