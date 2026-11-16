"use client";

import { Lightning } from "@elmeragroup/fuse/icons";
import { Item } from "@elmeragroup/fuse/item";

export function ItemIconMedia() {
  return (
    <div className="max-w-md w-full">
      <Item.Root>
        <Item.Media variant="icon">
          <Lightning aria-hidden />
        </Item.Media>
        <Item.Content>
          <Item.Title>Spot</Item.Title>
        </Item.Content>
      </Item.Root>
    </div>
  );
}
