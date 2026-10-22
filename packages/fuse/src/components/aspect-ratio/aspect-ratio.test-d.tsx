import { expectTypeOf, test } from "vitest";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";
import type { AspectRatioProps, AspectRatioValue } from "@elmeragroup/fuse/aspect-ratio";

test("ratio is a required string from the seven-ratio set", () => {
  expectTypeOf<AspectRatioValue>().toEqualTypeOf<"1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "16:9" | "9:16">();
  expectTypeOf<AspectRatioProps["ratio"]>().toEqualTypeOf<AspectRatioValue>();

  const _square = <AspectRatio ratio="1:1" />;
  const _landscape = <AspectRatio ratio="4:3" />;
  const _portrait = <AspectRatio ratio="3:4" />;
  const _photo = <AspectRatio ratio="3:2" />;
  const _portraitPhoto = <AspectRatio ratio="2:3" />;
  const _video = <AspectRatio ratio="16:9" />;
  const _story = <AspectRatio ratio="9:16" />;

  // @ts-expect-error a number is not a ratio string
  const _number = <AspectRatio ratio={16 / 9} />;
  // @ts-expect-error ratio has no default
  const _missing = <AspectRatio />;
  // @ts-expect-error 21:9 is outside the set
  const _wide = <AspectRatio ratio="21:9" />;
  // @ts-expect-error AspectRatio renders its own div and takes no render prop
  const _render = <AspectRatio ratio="1:1" render={<span />} />;
});
