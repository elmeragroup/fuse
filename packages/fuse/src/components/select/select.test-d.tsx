import { expectTypeOf, test } from "vitest";

import type { Select as RootSelect } from "@elmeragroup/fuse";
import type { SelectContentProps, SelectTriggerProps } from "@elmeragroup/fuse/select";
import { Select } from "@elmeragroup/fuse/select";

test("Select ships from the select entry and the root barrel", () => {
  expectTypeOf<typeof Select>().toEqualTypeOf<typeof RootSelect>();
  expectTypeOf(Select.Root).toBeFunction();
  expectTypeOf(Select.Trigger).toBeFunction();
  expectTypeOf(Select.Value).toBeFunction();
  expectTypeOf(Select.Content).toBeFunction();
  expectTypeOf(Select.Item).toBeFunction();
  expectTypeOf(Select.Group).toBeFunction();
  expectTypeOf(Select.Label).toBeFunction();
  expectTypeOf(Select.Separator).toBeFunction();
  expectTypeOf(Select.ScrollUpButton).toBeFunction();
  expectTypeOf(Select.ScrollDownButton).toBeFunction();
});

test("Portal, Positioner and Popup stay off the public namespace", () => {
  expectTypeOf(Select).not.toHaveProperty("Portal");
  expectTypeOf(Select).not.toHaveProperty("Positioner");
  expectTypeOf(Select).not.toHaveProperty("Popup");
});

test("Trigger takes size and Content takes positioner props, alignItemWithTrigger and container", () => {
  expectTypeOf<SelectTriggerProps["size"]>().toEqualTypeOf<"sm" | "default" | undefined>();
  expectTypeOf<SelectContentProps["side"]>().toEqualTypeOf<
    "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start" | undefined
  >();
  expectTypeOf<SelectContentProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();
  expectTypeOf<SelectContentProps["alignItemWithTrigger"]>().toEqualTypeOf<boolean | undefined>();

  const _tree = (
    <Select.Root>
      <Select.Trigger size="sm">
        <Select.Value placeholder="Pick one" />
      </Select.Trigger>
      <Select.Content side="bottom" align="center" sideOffset={4} alignOffset={0} alignItemWithTrigger>
        <Select.Group>
          <Select.Label>Fruits</Select.Label>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.ScrollUpButton />
        <Select.ScrollDownButton />
      </Select.Content>
    </Select.Root>
  );

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Select.Trigger as="div" />;
});

test("Root forwards Value and Multiple so value callbacks stay inferred", () => {
  type Fruit = "apple" | "banana";
  const singleValue: Fruit = "apple";
  const multipleValue: Fruit[] = ["apple"];

  const _single = (
    <Select.Root<Fruit>
      value={singleValue}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Fruit | null>();
      }}
    />
  );

  const _multiple = (
    <Select.Root<Fruit, true>
      multiple
      value={multipleValue}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Fruit[]>();
      }}
    />
  );

  // @ts-expect-error multiple value is array-shaped
  const _scalarWhenMultiple = <Select.Root<Fruit, true> multiple value="apple" />;
});
