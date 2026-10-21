import { expectTypeOf, test } from "vitest";

import * as cardEntry from "@elmeragroup/fuse/card";
import { Card, cardVariants } from "@elmeragroup/fuse/card";
import { Dialog } from "@elmeragroup/fuse/dialog";

test("cardVariants is public and slotted with direction and size axes, and parts take them with no polymorphic as prop", () => {
  expectTypeOf(cardVariants).toBeFunction();
  expectTypeOf(cardVariants({ direction: "horizontal" }).base()).toBeString();
  expectTypeOf(cardVariants({ size: "lg" }).base()).toBeString();
  expectTypeOf(cardVariants().cardHeader()).toBeString();

  // @ts-expect-error the external ref's surface axes are decomposed away
  cardVariants({ variant: "bright" });

  const _root = <Card.Root direction="horizontal" size="lg" />;
  const _title = (
    <Card.Title level={2} size="xl" icon={<svg aria-hidden />}>
      Usage
    </Card.Title>
  );
  const _description = <Card.Description size="lg">Body</Card.Description>;

  const _section = (
    <Card.Root>
      <Card.Section>
        <Card.SectionMedia>
          <svg aria-hidden />
        </Card.SectionMedia>
        <p>Moving out on 1 November.</p>
      </Card.Section>
      <Card.SectionButton onClick={() => undefined}>No thanks</Card.SectionButton>
      <Card.SectionButton render={<a href="/terms" />}>Read the terms</Card.SectionButton>
      <Dialog.Root>
        <Dialog.Trigger render={<Card.SectionButton />}>Change plan</Dialog.Trigger>
      </Dialog.Root>
    </Card.Root>
  );
  // @ts-expect-error a section takes the card's size from the root
  const _sectionPartSize = <Card.Section size="lg" />;
  // @ts-expect-error a static section is not polymorphic; a section that acts is Card.SectionButton
  const _sectionRender = <Card.Section render={<button type="button" />} />;
  // @ts-expect-error sections belong in a vertical card and take no direction
  const _sectionDirection = <Card.Section direction="horizontal" />;
  // The section recipe stays private: off the public cardVariants and out of the entry.
  expectTypeOf(cardVariants()).not.toHaveProperty("cardSection");
  expectTypeOf(cardEntry).not.toHaveProperty("cardSectionVariants");
  // @ts-expect-error level is constrained to 1-6
  const _badLevel = <Card.Title level={7} />;
  // @ts-expect-error the card's size is the root's alone
  const _sectionSize = <Card.Content size="lg" />;
  // @ts-expect-error the card has no small size
  const _badSize = <Card.Root size="sm" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Card.Root as="section" />;
});
