"use client";

import { Item } from "@elmeragroup/ui/item";

export function ItemAsButton() {
  return (
    <Item.Root render={<button type="button" />}>
      <Item.Content>
        <Item.Title>Choose this product</Item.Title>
      </Item.Content>
    </Item.Root>
  );
}
