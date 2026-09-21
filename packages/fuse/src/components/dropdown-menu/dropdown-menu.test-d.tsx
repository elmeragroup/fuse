import { expectTypeOf, test } from "vitest";

import type { DropdownMenu as RootDropdownMenu } from "@elmeragroup/fuse";
import type {
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuSubContentProps,
} from "@elmeragroup/fuse/dropdown-menu";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";

test("DropdownMenu ships from the dropdown-menu entry and the root barrel", () => {
  expectTypeOf<typeof DropdownMenu>().toEqualTypeOf<typeof RootDropdownMenu>();
  expectTypeOf(DropdownMenu.Root).toBeFunction();
  expectTypeOf(DropdownMenu.Trigger).toBeFunction();
  expectTypeOf(DropdownMenu.Portal).toBeFunction();
  expectTypeOf(DropdownMenu.Content).toBeFunction();
  expectTypeOf(DropdownMenu.Group).toBeFunction();
  expectTypeOf(DropdownMenu.Label).toBeFunction();
  expectTypeOf(DropdownMenu.Item).toBeFunction();
  expectTypeOf(DropdownMenu.LinkItem).toBeFunction();
  expectTypeOf(DropdownMenu.CheckboxItem).toBeFunction();
  expectTypeOf(DropdownMenu.RadioGroup).toBeFunction();
  expectTypeOf(DropdownMenu.RadioItem).toBeFunction();
  expectTypeOf(DropdownMenu.Separator).toBeFunction();
  expectTypeOf(DropdownMenu.Shortcut).toBeFunction();
  expectTypeOf(DropdownMenu.Sub).toBeFunction();
  expectTypeOf(DropdownMenu.SubTrigger).toBeFunction();
  expectTypeOf(DropdownMenu.SubContent).toBeFunction();
});

test("Positioner and Popup stay off the public namespace", () => {
  expectTypeOf(DropdownMenu).not.toHaveProperty("Positioner");
  expectTypeOf(DropdownMenu).not.toHaveProperty("Popup");
});

test("dropdownMenuItemClassName is not a public export", () => {
  expectTypeOf(DropdownMenu).not.toHaveProperty("dropdownMenuItemClassName");
});

test("Content and SubContent take positioner props and container, Item takes inset and variant", () => {
  expectTypeOf<DropdownMenuContentProps["side"]>().toEqualTypeOf<
    "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start" | undefined
  >();
  expectTypeOf<DropdownMenuContentProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();
  expectTypeOf<DropdownMenuSubContentProps["alignOffset"]>().toEqualTypeOf<
    DropdownMenuContentProps["alignOffset"]
  >();
  expectTypeOf<DropdownMenuItemProps["inset"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<DropdownMenuItemProps["variant"]>().toEqualTypeOf<"default" | "destructive" | undefined>();

  const _tree = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger />
      <DropdownMenu.Content side="bottom" align="start" sideOffset={4} alignOffset={0}>
        <DropdownMenu.Item inset variant="destructive" />
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger inset />
          <DropdownMenu.SubContent side="right" align="start" alignOffset={-3} sideOffset={0} />
        </DropdownMenu.Sub>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <DropdownMenu.Trigger as="div" />;
});

test("RadioGroup ties value, defaultValue and onValueChange to one union", () => {
  type Panel = "status" | "activity";

  const _controlled = (
    <DropdownMenu.RadioGroup<Panel>
      value="status"
      onValueChange={(next) => expectTypeOf(next).toEqualTypeOf<Panel>()}
    />
  );
  const _uncontrolled = <DropdownMenu.RadioGroup<Panel> defaultValue="activity" />;

  // @ts-expect-error the controlled value must be a member of the group's union
  const _invalidValue = <DropdownMenu.RadioGroup<Panel> value="settings" />;
  // @ts-expect-error a group is controlled or uncontrolled, never both
  const _both = <DropdownMenu.RadioGroup<Panel> value="status" defaultValue="activity" />;
});
