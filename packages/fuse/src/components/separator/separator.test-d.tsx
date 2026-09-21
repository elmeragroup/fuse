import { expectTypeOf, test } from "vitest";

import type { Separator as RootSeparator } from "@elmeragroup/fuse";
import type { SeparatorProps } from "@elmeragroup/fuse/separator";
import { Separator } from "@elmeragroup/fuse/separator";

test("Separator ships from the separator entry and the root barrel", () => {
  expectTypeOf<typeof Separator>().toEqualTypeOf<typeof RootSeparator>();
  expectTypeOf(Separator).toBeFunction();
});

test("orientation is the two-value primitive axis and stays optional", () => {
  expectTypeOf<SeparatorProps["orientation"]>().toEqualTypeOf<"horizontal" | "vertical" | undefined>();

  const _horizontal = <Separator orientation="horizontal" />;
  const _vertical = <Separator orientation="vertical" />;
  const _default = <Separator />;

  // @ts-expect-error the primitive axis has no third value
  const _badOrientation = <Separator orientation="both" />;
  // @ts-expect-error Separator has no recipe axis of its own
  const _noVariant = <Separator variant="muted" />;
});

test("the render prop is useRender's, never a polymorphic as prop", () => {
  const _render = <Separator render={<hr />} />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Separator as="hr" />;
});
