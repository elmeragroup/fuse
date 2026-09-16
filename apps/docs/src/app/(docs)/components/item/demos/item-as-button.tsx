"use client";

import { useState } from "react";

import { Item } from "@elmeragroup/ui/item";

/** A toggle button reports its selected product and can be pressed again to reset. */
export function ItemAsButton() {
  const [selected, setSelected] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Item.Root
        render={<button type="button" aria-pressed={selected} onClick={() => setSelected(!selected)} />}>
        <Item.Content>
          <Item.Title>{selected ? "Clear product selection" : "Choose this product"}</Item.Title>
        </Item.Content>
      </Item.Root>
      <p role="status">{selected ? "Product selected." : "No product selected."}</p>
    </div>
  );
}
