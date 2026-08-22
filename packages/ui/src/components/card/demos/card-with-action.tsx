import { Button } from "@elmeragroup/ui/button";
import { Card } from "@elmeragroup/ui/card";

export function CardWithAction() {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Invoice 4821</Card.Title>
        <Card.Description>Due 12 April.</Card.Description>
        <Card.Action>
          <Button size="sm" variant="outline">
            Export
          </Button>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <p>NOK 2 310,00</p>
      </Card.Content>
    </Card.Root>
  );
}
