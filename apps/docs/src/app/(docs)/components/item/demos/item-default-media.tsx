"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemDefaultMedia() {
  return (
    <div className="max-w-md w-full">
      <Item.Root>
        <Item.Media>
          <span
            aria-hidden
            className="text-sm font-medium flex size-10 items-center justify-center rounded-full bg-muted">
            KN
          </span>
        </Item.Media>
        <Item.Content>
          <Item.Title>Kari Nordmann</Item.Title>
          <Item.Description>Account owner</Item.Description>
        </Item.Content>
      </Item.Root>
    </div>
  );
}
