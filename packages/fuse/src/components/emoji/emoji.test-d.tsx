import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { EmojiProps } from "@elmeragroup/fuse/emoji";
import { Emoji, SlightlySmilingFace } from "@elmeragroup/fuse/emoji";

test("EmojiProps is svg props plus optional label so ref passes through", () => {
  expectTypeOf<EmojiProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<EmojiProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<EmojiProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<EmojiProps["ref"]>().toEqualTypeOf<ComponentProps<"svg">["ref"]>();
});

test("faces take native svg props, label, and no as or face axis", () => {
  const _decorative = <Emoji.SlightlySmilingFace className="size-5" />;
  const _labeled = <SlightlySmilingFace label="Very satisfied" className="size-4 shrink-0" />;
  const _ref = <Emoji.PartyingFace ref={null} />;

  expectTypeOf(Emoji).not.toHaveProperty("Root");
  expectTypeOf<EmojiProps>().not.toHaveProperty("as");
  expectTypeOf<EmojiProps>().not.toHaveProperty("face");

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Emoji.NeutralFace as="div" />;
});
