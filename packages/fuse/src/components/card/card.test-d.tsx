import { expectTypeOf, test } from "vitest";

import { Card, cardVariants } from "@elmeragroup/fuse/card";

test("cardVariants is public and slotted with a single direction axis", () => {
  expectTypeOf(cardVariants).toBeFunction();
  expectTypeOf(cardVariants({ direction: "horizontal" }).base()).toBeString();
  expectTypeOf(cardVariants().cardHeader()).toBeString();

  // @ts-expect-error the external ref's surface axes are decomposed away
  cardVariants({ variant: "bright" });
});

test("parts take the shared direction axis and no polymorphic as prop", () => {
  const _root = <Card.Root direction="horizontal" />;
  const _title = (
    <Card.Title level={2} size="xl" icon={<svg aria-hidden />}>
      Usage
    </Card.Title>
  );
  const _description = <Card.Description size="lg">Body</Card.Description>;

  // @ts-expect-error level is constrained to 1-6
  const _badLevel = <Card.Title level={7} />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Card.Root as="section" />;
});
