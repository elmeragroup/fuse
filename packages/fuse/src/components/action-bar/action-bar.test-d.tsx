import { expectTypeOf, test } from "vitest";

import { ActionBar } from "@elmeragroup/fuse/action-bar";
import type { ActionBarRootProps } from "@elmeragroup/fuse/action-bar";
import { Button } from "@elmeragroup/fuse/button";

test("Root requires the selection size, takes a px offset and is horizontal only", () => {
  expectTypeOf<ActionBarRootProps["count"]>().toEqualTypeOf<number>();
  expectTypeOf<ActionBarRootProps["offset"]>().toEqualTypeOf<number | undefined>();

  const _bar = (
    <ActionBar.Root count={3} offset={72} aria-label="Order actions" loopFocus={false}>
      <ActionBar.Count />
      <ActionBar.Clear onClick={() => undefined} />
      <ActionBar.Separator />
      <ActionBar.Button render={<Button variant="outline" size="xs" />} disabled>
        <ActionBar.ButtonLabel>Archive</ActionBar.ButtonLabel>
      </ActionBar.Button>
    </ActionBar.Root>
  );

  // @ts-expect-error the bar shows only for a selection, so it needs the selection size
  const _noCount = <ActionBar.Root />;
  // @ts-expect-error the count is a number, not the selected items
  const _itemsCount = <ActionBar.Root count={["a"]} />;
  // @ts-expect-error the bar floats along the bottom, so it has no vertical orientation
  const _vertical = <ActionBar.Root count={1} orientation="vertical" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <ActionBar.Button as="a" />;
});
