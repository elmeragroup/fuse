import { test } from "vitest";

import { Empty } from "@elmeragroup/fuse/empty";

test("parts take native attributes, the public variant unions, and no as prop", () => {
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
