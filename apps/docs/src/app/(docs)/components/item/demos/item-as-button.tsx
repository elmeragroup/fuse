"use client";

import { useState } from "react";

import { Item } from "@elmeragroup/fuse/item";

export function ItemAsButton() {
  const [selected, setSelected] = useState(false);
  return (
    <div className="max-w-md flex w-full flex-col gap-3">
      <Item.Root
        variant="outline"
        render={<button type="button" aria-pressed={selected} onClick={() => setSelected(!selected)} />}>
        <Item.Content>
          <Item.Title>Spot</Item.Title>
          <Item.Description>Hourly price with no lock-in.</Item.Description>
        </Item.Content>
      </Item.Root>
      <p role="status">{selected ? "Spot selected." : "No product selected."}</p>
    </div>
  );
}
