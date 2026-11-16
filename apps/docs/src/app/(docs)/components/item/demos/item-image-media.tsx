"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemImageMedia() {
  return (
    <div className="max-w-md w-full">
      <Item.Root>
        <Item.Media variant="image">
          <img alt="" src="/demos/photos/leaf.webp" />
        </Item.Media>
        <Item.Content>
          <Item.Title>Green certificate</Item.Title>
          <Item.Description>Renewable origin for every kWh.</Item.Description>
        </Item.Content>
      </Item.Root>
    </div>
  );
}
