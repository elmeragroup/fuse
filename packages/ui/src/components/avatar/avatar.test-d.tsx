import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Avatar as RootAvatar } from "@elmeragroup/ui";
import * as AvatarModule from "@elmeragroup/ui/avatar";
import { Avatar } from "@elmeragroup/ui/avatar";

test("the namespace ships all three parts from the avatar entry and the root barrel", () => {
  expectTypeOf<typeof Avatar>().toEqualTypeOf<typeof RootAvatar>();
  expectTypeOf(Avatar).toHaveProperty("Root");
  expectTypeOf(Avatar).toHaveProperty("Image");
  expectTypeOf(Avatar).toHaveProperty("Fallback");
});

test("public API exports only the namespace — flat parts and the recipe stay private", () => {
  expectTypeOf(AvatarModule).not.toHaveProperty("avatarVariants");
  expectTypeOf(AvatarModule).not.toHaveProperty("AvatarRoot");
  expectTypeOf(AvatarModule).not.toHaveProperty("AvatarImage");
  expectTypeOf(AvatarModule).not.toHaveProperty("AvatarFallback");
  expectTypeOf(AvatarModule).not.toHaveProperty("AvatarProps");
});

test("parts take the primitive passthrough surface and no as prop", () => {
  const _root = (
    <Avatar.Root className="size-10" aria-label="Ada Lovelace">
      <Avatar.Image src="/ada.png" alt="Ada Lovelace" onLoadingStatusChange={() => undefined} />
      <Avatar.Fallback delay={400}>AL</Avatar.Fallback>
    </Avatar.Root>
  );
  const _ref = <Avatar.Root ref={null} />;

  expectTypeOf<ComponentProps<typeof Avatar.Image>>().toHaveProperty("src");
  expectTypeOf<ComponentProps<typeof Avatar.Image>>().toHaveProperty("alt");
  expectTypeOf<ComponentProps<typeof Avatar.Image>>().toHaveProperty("onLoadingStatusChange");
  expectTypeOf<ComponentProps<typeof Avatar.Image>>().toHaveProperty("render");
  expectTypeOf<ComponentProps<typeof Avatar.Fallback>>().toHaveProperty("delay");
  expectTypeOf<ComponentProps<typeof Avatar.Root>>().toHaveProperty("render");

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Avatar.Root as="div" />;
});

test("Root takes the grouped ring prop without losing the primitive surface", () => {
  const _grouped = <Avatar.Root grouped={true} />;
  const _ungrouped = <Avatar.Root grouped={false} />;

  expectTypeOf<ComponentProps<typeof Avatar.Root>>().toHaveProperty("grouped");
  expectTypeOf<ComponentProps<typeof Avatar.Root>["grouped"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComponentProps<typeof Avatar.Root>>().toHaveProperty("className");
  expectTypeOf<ComponentProps<typeof Avatar.Root>>().toHaveProperty("render");
});
