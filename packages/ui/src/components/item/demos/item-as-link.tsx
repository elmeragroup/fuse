import { Item } from "@elmeragroup/ui/item";

export function ItemAsLink() {
  return (
    <Item.Root variant="outline" render={<a href="#order" />}>
      <Item.Content>
        <Item.Title>Open order</Item.Title>
        <Item.Description>Continue where you left off.</Item.Description>
      </Item.Content>
    </Item.Root>
  );
}
