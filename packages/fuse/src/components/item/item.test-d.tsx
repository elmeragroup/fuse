import { expectTypeOf, test } from "vitest";

import type { Item as RootItem } from "@elmeragroup/fuse";
import { Item, itemVariants } from "@elmeragroup/fuse/item";

test("the namespace ships all ten parts from the item entry and the root barrel", () => {
  expectTypeOf<typeof Item>().toEqualTypeOf<typeof RootItem>();
  expectTypeOf(Item).toHaveProperty("Root");
  expectTypeOf(Item).toHaveProperty("Media");
  expectTypeOf(Item).toHaveProperty("Content");
  expectTypeOf(Item).toHaveProperty("Actions");
  expectTypeOf(Item).toHaveProperty("Group");
  expectTypeOf(Item).toHaveProperty("Separator");
  expectTypeOf(Item).toHaveProperty("Title");
  expectTypeOf(Item).toHaveProperty("Description");
  expectTypeOf(Item).toHaveProperty("Header");
  expectTypeOf(Item).toHaveProperty("Footer");
});

test("itemVariants is public and carries the variant and size axes", () => {
  expectTypeOf(itemVariants).toBeFunction();
  expectTypeOf(itemVariants({ variant: "outline", size: "xs" })).toBeString();

  // @ts-expect-error the surface axis is default | outline | muted
  itemVariants({ variant: "ghost" });
  // @ts-expect-error the size axis is default | sm | xs
  itemVariants({ size: "lg" });
});

test("Root takes the recipe axes plus useRender's render prop, never a polymorphic as prop", () => {
  const _root = <Item.Root variant="muted" size="sm" />;
  const _link = <Item.Root render={<a href="#order" />}>Order overview</Item.Root>;
  const _button = <Item.Root render={<button type="button" />} />;
  const _media = <Item.Media variant="image" />;
  const _footer = <Item.Footer mode="hidden" />;

  // @ts-expect-error the media axis is default | icon | image
  const _badMedia = <Item.Media variant="outline" />;
  // @ts-expect-error the footer axis is default | visible | hidden
  const _badMode = <Item.Footer mode="open" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Item.Root as="li" />;
});
