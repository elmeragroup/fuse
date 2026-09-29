import { expectTypeOf, test } from "vitest";

import type { SeparatorProps } from "@elmeragroup/fuse/separator";
import { Separator } from "@elmeragroup/fuse/separator";

test("orientation is the two-value primitive axis and stays optional, and render is never an as prop", () => {
  expectTypeOf<SeparatorProps["orientation"]>().toEqualTypeOf<"horizontal" | "vertical" | undefined>();

  const _horizontal = <Separator orientation="horizontal" />;
  const _vertical = <Separator orientation="vertical" />;
  const _default = <Separator />;

  // @ts-expect-error the primitive axis has no third value
  const _badOrientation = <Separator orientation="both" />;
  // @ts-expect-error Separator has no recipe axis of its own
  const _noVariant = <Separator variant="muted" />;

  const _render = <Separator render={<hr />} />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Separator as="hr" />;
});
