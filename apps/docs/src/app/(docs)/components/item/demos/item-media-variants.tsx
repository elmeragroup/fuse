"use client";

import { Lightning } from "@elmeragroup/fuse/icons";
import { Item } from "@elmeragroup/fuse/item";

export function ItemMediaVariants() {
  return (
    <div className="flex flex-col gap-3">
      <Item.Root>
        <Item.Media variant="icon">
          <Lightning aria-hidden />
        </Item.Media>
        <Item.Title>Icon</Item.Title>
      </Item.Root>
      <Item.Root>
        <Item.Media variant="image">
          <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
        </Item.Media>
        <Item.Title>Image</Item.Title>
      </Item.Root>
    </div>
  );
}
