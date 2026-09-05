import { expectTypeOf, test } from "vitest";

import type { Card as RootCard } from "@elmeragroup/ui";
import * as CardModule from "@elmeragroup/ui/card";
import { Card, cardVariants } from "@elmeragroup/ui/card";

test("the namespace ships all eight parts from the card entry and the root barrel", () => {
  expectTypeOf<typeof Card>().toEqualTypeOf<typeof RootCard>();
  expectTypeOf(Card).toHaveProperty("Root");
  expectTypeOf(Card).toHaveProperty("Header");
  expectTypeOf(Card).toHaveProperty("Tag");
  expectTypeOf(Card).toHaveProperty("Title");
  expectTypeOf(Card).toHaveProperty("Description");
  expectTypeOf(Card).toHaveProperty("Action");
  expectTypeOf(Card).toHaveProperty("Content");
  expectTypeOf(Card).toHaveProperty("Footer");
});

test("cardVariants is public and slotted with a single direction axis", () => {
  expectTypeOf(cardVariants).toBeFunction();
  expectTypeOf(cardVariants({ direction: "horizontal" }).base()).toBeString();
  expectTypeOf(cardVariants().cardHeader()).toBeString();

  // @ts-expect-error the external ref's surface axes are decomposed away (card.md §8.5)
  cardVariants({ variant: "bright" });
});

test("title and description size recipes stay module-private", () => {
  expectTypeOf(CardModule).not.toHaveProperty("cardTitleVariants");
  expectTypeOf(CardModule).not.toHaveProperty("cardDescriptionVariants");
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
