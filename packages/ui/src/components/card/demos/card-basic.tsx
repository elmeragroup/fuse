import { Card } from "@elmeragroup/ui/card";

export function CardBasic() {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>March usage</Card.Title>
        <Card.Description>Estimated consumption for the period.</Card.Description>
      </Card.Header>
      <Card.Content>
        <p>1 240 kWh across two meters.</p>
      </Card.Content>
      <Card.Footer>
        <p>Settled 3 April.</p>
      </Card.Footer>
    </Card.Root>
  );
}
