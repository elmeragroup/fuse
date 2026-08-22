import { Item } from "@elmeragroup/ui/item";

export function ItemFooterReveal() {
  return (
    <div className="flex flex-col gap-3">
      <Item.Root>
        <Item.Title>Default footer</Item.Title>
        <Item.Footer>Always visible</Item.Footer>
      </Item.Root>
      <Item.Root>
        <Item.Title>Visible footer</Item.Title>
        <Item.Footer mode="visible">Entering</Item.Footer>
      </Item.Root>
      <Item.Root>
        <Item.Title>Hidden footer</Item.Title>
        <Item.Footer mode="hidden">Collapsed</Item.Footer>
      </Item.Root>
    </div>
  );
}
