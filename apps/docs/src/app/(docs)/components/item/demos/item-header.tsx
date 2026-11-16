"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemHeader() {
  return (
    <div className="max-w-md w-full">
      <Item.Root variant="outline">
        <Item.Header>
          <span>Invoice 4821</span>
          <span>Due on 12 April</span>
        </Item.Header>
        <Item.Content>
          <Item.Title>NOK 2 310,00</Item.Title>
          <Item.Description>Electricity and grid rent for March.</Item.Description>
        </Item.Content>
      </Item.Root>
    </div>
  );
}
