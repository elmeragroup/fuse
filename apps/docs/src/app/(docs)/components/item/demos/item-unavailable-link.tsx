"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemUnavailableLink() {
  return (
    <div className="max-w-md w-full">
      <Item.Root variant="outline" render={<a href="#invoice" aria-disabled="true" />}>
        <Item.Content>
          <Item.Title>Download invoice</Item.Title>
          <Item.Description>Available once the order ships.</Item.Description>
        </Item.Content>
      </Item.Root>
    </div>
  );
}
