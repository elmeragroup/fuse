"use client";

import { Item } from "@elmeragroup/fuse/item";

/** A link row, and an unavailable one that dims and does not navigate. */
export function ItemAsLink() {
  return (
    <div className="flex flex-col gap-3">
      <Item.Root variant="outline" render={<a href="#order" />}>
        <Item.Content>
          <Item.Title>Open order</Item.Title>
          <Item.Description>Continue where you left off.</Item.Description>
        </Item.Content>
      </Item.Root>
      <Item.Root variant="outline" render={<a href="#invoice" aria-disabled="true" />}>
        <Item.Content>
          <Item.Title>Download invoice</Item.Title>
          <Item.Description>Available once the order ships.</Item.Description>
        </Item.Content>
      </Item.Root>
    </div>
  );
}
