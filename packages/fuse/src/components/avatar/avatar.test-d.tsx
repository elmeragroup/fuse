import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Avatar as RootAvatar } from "@elmeragroup/fuse";
import * as AvatarModule from "@elmeragroup/fuse/avatar";
import { Avatar } from "@elmeragroup/fuse/avatar";

test("the namespace ships all four parts from the avatar entry and the root barrel", () => {
  expectTypeOf<typeof Avatar>().toEqualTypeOf<typeof RootAvatar>();
  expectTypeOf(Avatar).toHaveProperty("Root");
  expectTypeOf(Avatar).toHaveProperty("Group");
  expectTypeOf(Avatar).toHaveProperty("Image");
  expectTypeOf(Avatar).toHaveProperty("Fallback");
});

test("public API exports only the namespace — flat parts stay private", () => {
  expectTypeOf(AvatarModule).not.toHaveProperty("AvatarRoot");
  expectTypeOf(AvatarModule).not.toHaveProperty("AvatarGroup");
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

test("Group is a plain div part with no primitive props", () => {
  const _group = (
    <Avatar.Group className="pl-4" aria-label="Team">
      <Avatar.Root>
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    </Avatar.Group>
  );
  const _ref = <Avatar.Group ref={null} />;

  expectTypeOf<ComponentProps<typeof Avatar.Group>>().toEqualTypeOf<ComponentProps<"div">>();

  // @ts-expect-error Group is a native div, not a Base UI part
  const _noRender = <Avatar.Group render={<section />} />;
});
