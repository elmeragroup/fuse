"use client";

import { Card } from "@elmeragroup/ui/card";
import { Item } from "@elmeragroup/ui/item";

/**
 * The external rich card's `CardSectionAnchor` rows land here: real anchors via
 * `Item.Root render={<a/>}` inside `Card.Content`.
 */
export function CardItemRows() {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Deliveries</Card.Title>
        <Card.Description>Two active delivery points.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Item.Group>
          <Item.Root render={<a href="#storgata" />}>
            <Item.Content>
              <Item.Title>Storgata 1</Item.Title>
              <Item.Description>707057500012345678</Item.Description>
            </Item.Content>
          </Item.Root>
          <Item.Root render={<a href="#kirkeveien" />}>
            <Item.Content>
              <Item.Title>Kirkeveien 22</Item.Title>
              <Item.Description>707057500087654321</Item.Description>
            </Item.Content>
          </Item.Root>
        </Item.Group>
      </Card.Content>
    </Card.Root>
  );
}
