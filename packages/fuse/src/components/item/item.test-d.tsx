import { expectTypeOf, test } from "vitest";

import { Item, itemVariants } from "@elmeragroup/fuse/item";

test("itemVariants and Root carry the variant and size axes, and Root takes useRender's render prop but never a polymorphic as prop", () => {
  expectTypeOf(itemVariants).toBeFunction();
  expectTypeOf(itemVariants({ variant: "outline", size: "xs" })).toBeString();

  // @ts-expect-error the surface axis is default | outline | muted
  itemVariants({ variant: "ghost" });
  // @ts-expect-error the size axis is default | sm | xs
  itemVariants({ size: "lg" });

  const _root = <Item.Root variant="muted" size="sm" />;
  const _link = <Item.Root render={<a href="#order" />}>Order overview</Item.Root>;
  const _button = <Item.Root render={<button type="button" />} />;
  const _media = <Item.Media variant="image" />;
  const _footer = <Item.Footer mode="hidden" />;

  // @ts-expect-error the media axis is default | icon | image
  const _badMedia = <Item.Media variant="outline" />;
  // @ts-expect-error the footer axis is default | visible | hidden
  const _badMode = <Item.Footer mode="open" />;
  const _compact = <Item.Group variant="compact" />;
  const _defaultGroup = <Item.Group variant="default" />;
  // @ts-expect-error the group axis is default | compact
  const _badGroup = <Item.Group variant="outline" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Item.Root as="li" />;
});
