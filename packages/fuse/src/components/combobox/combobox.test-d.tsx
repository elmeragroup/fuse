import type { RefObject } from "react";

import { expectTypeOf, test } from "vitest";

import type { Combobox as RootCombobox, useComboboxAnchor as RootUseComboboxAnchor } from "@elmeragroup/fuse";
import type {
  ComboboxChipProps,
  ComboboxClearProps,
  ComboboxContentProps,
  ComboboxInputProps,
  ComboboxRootProps,
} from "@elmeragroup/fuse/combobox";
import * as ComboboxModule from "@elmeragroup/fuse/combobox";
import { Combobox, useComboboxAnchor } from "@elmeragroup/fuse/combobox";

test("Combobox and useComboboxAnchor ship from the combobox entry and the root barrel", () => {
  expectTypeOf<typeof Combobox>().toEqualTypeOf<typeof RootCombobox>();
  expectTypeOf<typeof useComboboxAnchor>().toEqualTypeOf<typeof RootUseComboboxAnchor>();
  expectTypeOf(Combobox.Root).toBeFunction();
  expectTypeOf(Combobox.Input).toBeFunction();
  expectTypeOf(Combobox.Trigger).toBeFunction();
  expectTypeOf(Combobox.Clear).toBeFunction();
  expectTypeOf(Combobox.Content).toBeFunction();
  expectTypeOf(Combobox.List).toBeFunction();
  expectTypeOf(Combobox.Item).toBeFunction();
  expectTypeOf(Combobox.Group).toBeFunction();
  expectTypeOf(Combobox.Label).toBeFunction();
  expectTypeOf(Combobox.Collection).toBeFunction();
  expectTypeOf(Combobox.Empty).toBeFunction();
  expectTypeOf(Combobox.Separator).toBeFunction();
  expectTypeOf(Combobox.Chips).toBeFunction();
  expectTypeOf(Combobox.Chip).toBeFunction();
  expectTypeOf(Combobox.ChipsInput).toBeFunction();
  expectTypeOf(Combobox.Value).toBeFunction();
  expectTypeOf(useComboboxAnchor).toBeFunction();
});

test("Portal, Positioner and Popup stay off the public namespace", () => {
  expectTypeOf(Combobox).not.toHaveProperty("Portal");
  expectTypeOf(Combobox).not.toHaveProperty("Positioner");
  expectTypeOf(Combobox).not.toHaveProperty("Popup");
  expectTypeOf(ComboboxModule).not.toHaveProperty("comboboxVariants");
  expectTypeOf(ComboboxModule).not.toHaveProperty("ComboboxInput");
  expectTypeOf(ComboboxModule).not.toHaveProperty("ComboboxClear");
});

test("Input, Content, Chip and Clear take the public extra props and Root omits locale", () => {
  expectTypeOf<ComboboxInputProps["showTrigger"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxInputProps["showClear"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxInputProps["clearLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ComboboxClearProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ComboboxChipProps["showRemove"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxChipProps["removeLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ComboboxContentProps["side"]>().toEqualTypeOf<
    "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start" | undefined
  >();
  expectTypeOf<ComboboxContentProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();
  expectTypeOf<ComboboxRootProps>().not.toHaveProperty("locale");

  const _tree = (
    <Combobox.Root items={["apple"]}>
      <Combobox.Input placeholder="Search…" showTrigger showClear clearLabel="Wipe">
        <input type="hidden" name="fruit" />
      </Combobox.Input>
      <Combobox.Content side="bottom" align="start" sideOffset={6} alignOffset={0}>
        <Combobox.Empty>Nothing.</Combobox.Empty>
        <Combobox.List>
          <Combobox.Collection>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.Collection>
        </Combobox.List>
        <Combobox.Separator />
      </Combobox.Content>
    </Combobox.Root>
  );

  const _chips = (
    <Combobox.Root multiple>
      <Combobox.Chips>
        <Combobox.Chip showRemove removeLabel="Drop">
          Apple
        </Combobox.Chip>
        <Combobox.ChipsInput />
      </Combobox.Chips>
      <Combobox.Clear label="Wipe" />
      <Combobox.Value />
      <Combobox.Trigger />
    </Combobox.Root>
  );

  const _anchor: RefObject<HTMLDivElement | null> = useComboboxAnchor();
  const _anchored = <Combobox.Content anchor={_anchor} />;

  // @ts-expect-error locale is provider-only
  const _noLocale = <Combobox.Root locale="nb-NO" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Combobox.Input as="div" />;
});

test("Root forwards Value and Multiple so value callbacks stay inferred", () => {
  type Fruit = "apple" | "banana";
  const singleValue: Fruit = "apple";
  const multipleValue: Fruit[] = ["apple"];

  const _single = (
    <Combobox.Root<Fruit>
      value={singleValue}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Fruit | null>();
      }}
    />
  );

  const _multiple = (
    <Combobox.Root<Fruit, true>
      multiple
      value={multipleValue}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Fruit[]>();
      }}
    />
  );

  // @ts-expect-error multiple value is array-shaped
  const _scalarWhenMultiple = <Combobox.Root<Fruit, true> multiple value="apple" />;
});
