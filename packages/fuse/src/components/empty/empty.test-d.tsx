import { expectTypeOf, test } from "vitest";

import type { Empty as RootEmpty } from "@elmeragroup/fuse";
import * as EmptyModule from "@elmeragroup/fuse/empty";
import { Empty } from "@elmeragroup/fuse/empty";

test("the namespace ships all six parts from the empty entry and the root barrel", () => {
  expectTypeOf<typeof Empty>().toEqualTypeOf<typeof RootEmpty>();
  expectTypeOf(Empty).toHaveProperty("Root");
  expectTypeOf(Empty).toHaveProperty("Header");
  expectTypeOf(Empty).toHaveProperty("Media");
  expectTypeOf(Empty).toHaveProperty("Title");
  expectTypeOf(Empty).toHaveProperty("Description");
  expectTypeOf(Empty).toHaveProperty("Content");
});

test("public API exports only the namespace — recipes and flat parts stay private", () => {
  expectTypeOf(EmptyModule).not.toHaveProperty("emptyVariants");
  expectTypeOf(EmptyModule).not.toHaveProperty("emptyMediaVariants");
  expectTypeOf(EmptyModule).not.toHaveProperty("EmptyHeader");
  expectTypeOf(EmptyModule).not.toHaveProperty("EmptyMedia");
  expectTypeOf(EmptyModule).not.toHaveProperty("EmptyTitle");
  expectTypeOf(EmptyModule).not.toHaveProperty("EmptyDescription");
  expectTypeOf(EmptyModule).not.toHaveProperty("EmptyContent");
  expectTypeOf(EmptyModule).not.toHaveProperty("EmptyProps");
  expectTypeOf(Empty).not.toHaveProperty("Icon");
});

test("parts take native attributes, the spec variant unions, and no as prop", () => {
  const _root = (
    <Empty.Root variant="outline-dashed" className="max-w-md">
      <Empty.Header>
        <Empty.Media variant="icon" />
        <Empty.Title>No orders yet</Empty.Title>
        <Empty.Description>
          Read the <a href="#help">help article</a>.
        </Empty.Description>
      </Empty.Header>
      <Empty.Content>
        <button type="button">Create order</button>
      </Empty.Content>
    </Empty.Root>
  );
  const _defaultMedia = <Empty.Media />;
  const _ref = <Empty.Description ref={null}>Orders you create will show up here.</Empty.Description>;

  // @ts-expect-error variant is the root frame axis only
  const _badRoot = <Empty.Root variant="icon" />;
  // @ts-expect-error media has no outline frame axis
  const _badMedia = <Empty.Media variant="outline" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Empty.Root as="section" />;
});
