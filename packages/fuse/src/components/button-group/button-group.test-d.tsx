import { test } from "vitest";

import { ButtonGroup } from "@elmeragroup/fuse/button-group";

test("parts take the public props, Text render, and no polymorphic as prop", () => {
  const _root = (
    <ButtonGroup.Root orientation="horizontal" className="w-full" aria-label="Actions">
      <ButtonGroup.Text>https://</ButtonGroup.Text>
      <ButtonGroup.Text render={<label htmlFor="amount" />}>NOK</ButtonGroup.Text>
      <ButtonGroup.Separator />
      <ButtonGroup.Separator orientation="horizontal" />
    </ButtonGroup.Root>
  );
  const _vertical = <ButtonGroup.Root orientation="vertical" />;
  const _ref = <ButtonGroup.Root ref={null} />;

  // @ts-expect-error orientation is horizontal | vertical only
  const _badOrientation = <ButtonGroup.Root orientation="responsive" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <ButtonGroup.Root as="section" />;
  // @ts-expect-error Text polymorphism is render, not as
  const _noTextAs = <ButtonGroup.Text as="span" />;
});
