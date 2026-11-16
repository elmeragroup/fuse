"use client";

import { Lightning } from "@elmeragroup/fuse/icons";
import { Item } from "@elmeragroup/fuse/item";

export function ItemDemo() {
  return (
    <div className="max-w-md w-full">
      <Item.Root>
        <Item.Media variant="icon">
          <Lightning aria-hidden />
        </Item.Media>
        <Item.Content>
          <Item.Title>Spot</Item.Title>
          <Item.Description>Hourly price with no lock-in.</Item.Description>
        </Item.Content>
        <Item.Actions>
          <span>Active</span>
        </Item.Actions>
      </Item.Root>
    </div>
  );
}
