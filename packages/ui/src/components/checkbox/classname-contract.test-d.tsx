import type { ComponentProps } from "react";

import { expectTypeOf, it } from "vitest";

import type { Avatar } from "@elmeragroup/ui/avatar";
import type { Button } from "@elmeragroup/ui/button";
import type { ButtonGroup } from "@elmeragroup/ui/button-group";
import type { Checkbox } from "@elmeragroup/ui/checkbox";
import type { Collapsible } from "@elmeragroup/ui/collapsible";
import type { Combobox } from "@elmeragroup/ui/combobox";
import type { Dialog } from "@elmeragroup/ui/dialog";
import type { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";
import type { Field } from "@elmeragroup/ui/field";
import type { Item } from "@elmeragroup/ui/item";
import type { Popover } from "@elmeragroup/ui/popover";
import type { ScrollArea } from "@elmeragroup/ui/scroll-area";
import type { Select } from "@elmeragroup/ui/select";
import type { Separator } from "@elmeragroup/ui/separator";
import type { Sheet } from "@elmeragroup/ui/sheet";
import type { Sidebar } from "@elmeragroup/ui/sidebar";
import type { Tabs } from "@elmeragroup/ui/tabs";
import type { Toast } from "@elmeragroup/ui/toast";
import type { Toggle } from "@elmeragroup/ui/toggle";
import type { Tooltip } from "@elmeragroup/ui/tooltip";

it("Dialog.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Dialog.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Dialog.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Dialog.Close preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Dialog.Close>["className"]>();
  expectTypeOf<ComponentProps<typeof Dialog.Close>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Dialog.Overlay preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Dialog.Overlay>["className"]>();
  expectTypeOf<ComponentProps<typeof Dialog.Overlay>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Dialog.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Dialog.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Dialog.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Dialog.Title preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Dialog.Title>["className"]>();
  expectTypeOf<ComponentProps<typeof Dialog.Title>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Dialog.Description preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Dialog.Description>["className"]>();
  expectTypeOf<ComponentProps<typeof Dialog.Description>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Separator preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Separator>["className"]>();
  expectTypeOf<ComponentProps<typeof Separator>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Item.Separator preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Item.Separator>["className"]>();
  expectTypeOf<ComponentProps<typeof Item.Separator>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Avatar.Root preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Avatar.Root>["className"]>();
  expectTypeOf<ComponentProps<typeof Avatar.Root>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Avatar.Image preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Avatar.Image>["className"]>();
  expectTypeOf<ComponentProps<typeof Avatar.Image>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Avatar.Fallback preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Avatar.Fallback>["className"]>();
  expectTypeOf<ComponentProps<typeof Avatar.Fallback>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("ButtonGroup.Separator preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof ButtonGroup.Separator>["className"]>();
  expectTypeOf<ComponentProps<typeof ButtonGroup.Separator>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Field.Root preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Field.Root>["className"]>();
  expectTypeOf<ComponentProps<typeof Field.Root>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Field.Set preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Field.Set>["className"]>();
  expectTypeOf<ComponentProps<typeof Field.Set>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Field.Legend preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Field.Legend>["className"]>();
  expectTypeOf<ComponentProps<typeof Field.Legend>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Field.Label preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Field.Label>["className"]>();
  expectTypeOf<ComponentProps<typeof Field.Label>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Field.Description preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Field.Description>["className"]>();
  expectTypeOf<ComponentProps<typeof Field.Description>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Field.Error preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Field.Error>["className"]>();
  expectTypeOf<ComponentProps<typeof Field.Error>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Checkbox preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Checkbox>["className"]>();
  expectTypeOf<ComponentProps<typeof Checkbox>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Collapsible.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Collapsible.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Collapsible.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Clear preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Clear>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Clear>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.List preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.List>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.List>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Item preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Item>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Item>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Group preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Group>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Group>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Label preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Label>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Label>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Empty preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Empty>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Empty>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Separator preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Separator>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Separator>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Chips preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Chips>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Chips>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Chip preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.Chip>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.Chip>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.ChipsInput preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Combobox.ChipsInput>["className"]>();
  expectTypeOf<ComponentProps<typeof Combobox.ChipsInput>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.SubContent preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.SubContent>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.SubContent>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.Label preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.Label>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.Label>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.Item preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.Item>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.Item>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.LinkItem preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.LinkItem>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.LinkItem>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.CheckboxItem preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.CheckboxItem>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.CheckboxItem>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.RadioItem preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.RadioItem>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.RadioItem>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.Separator preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.Separator>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.Separator>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("DropdownMenu.SubTrigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof DropdownMenu.SubTrigger>["className"]>();
  expectTypeOf<ComponentProps<typeof DropdownMenu.SubTrigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Popover.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Popover.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Popover.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Popover.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Popover.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Popover.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Popover.Title preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Popover.Title>["className"]>();
  expectTypeOf<ComponentProps<typeof Popover.Title>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Popover.Description preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Popover.Description>["className"]>();
  expectTypeOf<ComponentProps<typeof Popover.Description>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("ScrollArea.Root preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof ScrollArea.Root>["className"]>();
  expectTypeOf<ComponentProps<typeof ScrollArea.Root>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("ScrollArea.Bar preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof ScrollArea.Bar>["className"]>();
  expectTypeOf<ComponentProps<typeof ScrollArea.Bar>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.Value preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.Value>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.Value>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.Item preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.Item>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.Item>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.Group preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.Group>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.Group>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.Label preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.Label>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.Label>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.Separator preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.Separator>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.Separator>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.ScrollUpButton preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.ScrollUpButton>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.ScrollUpButton>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Select.ScrollDownButton preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Select.ScrollDownButton>["className"]>();
  expectTypeOf<ComponentProps<typeof Select.ScrollDownButton>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Sheet.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Sheet.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Sheet.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Sheet.Close preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Sheet.Close>["className"]>();
  expectTypeOf<ComponentProps<typeof Sheet.Close>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Sheet.Overlay preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Sheet.Overlay>["className"]>();
  expectTypeOf<ComponentProps<typeof Sheet.Overlay>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Sheet.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Sheet.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Sheet.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Sheet.Title preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Sheet.Title>["className"]>();
  expectTypeOf<ComponentProps<typeof Sheet.Title>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Sheet.Description preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Sheet.Description>["className"]>();
  expectTypeOf<ComponentProps<typeof Sheet.Description>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Tooltip.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Tooltip.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Tooltip.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Tooltip.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Tooltip.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Tooltip.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Sidebar.Separator preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Sidebar.Separator>["className"]>();
  expectTypeOf<ComponentProps<typeof Sidebar.Separator>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Tabs.Root preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Tabs.Root>["className"]>();
  expectTypeOf<ComponentProps<typeof Tabs.Root>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Tabs.List preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Tabs.List>["className"]>();
  expectTypeOf<ComponentProps<typeof Tabs.List>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Tabs.Trigger preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Tabs.Trigger>["className"]>();
  expectTypeOf<ComponentProps<typeof Tabs.Trigger>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Tabs.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Tabs.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Tabs.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Toast.Viewport preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Toast.Viewport>["className"]>();
  expectTypeOf<ComponentProps<typeof Toast.Viewport>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Toast.Root preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Toast.Root>["className"]>();
  expectTypeOf<ComponentProps<typeof Toast.Root>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Toast.Content preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Toast.Content>["className"]>();
  expectTypeOf<ComponentProps<typeof Toast.Content>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Toast.Title preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Toast.Title>["className"]>();
  expectTypeOf<ComponentProps<typeof Toast.Title>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Toast.Description preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Toast.Description>["className"]>();
  expectTypeOf<ComponentProps<typeof Toast.Description>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Toast.Action preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Toast.Action>["className"]>();
  expectTypeOf<ComponentProps<typeof Toast.Action>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Toast.Close preserves string and state-callback classes", () => {
  expectTypeOf<string>().toExtend<ComponentProps<typeof Toast.Close>["className"]>();
  expectTypeOf<ComponentProps<typeof Toast.Close>["className"]>()
    .extract<(...args: never[]) => string | undefined>()
    .not.toBeNever();
});

it("Combobox.Input remains string-only", () => {
  expectTypeOf<() => string>().not.toExtend<ComponentProps<typeof Combobox.Input>["className"]>();
});

it("Button remains string-only", () => {
  expectTypeOf<() => string>().not.toExtend<ComponentProps<typeof Button>["className"]>();
});

it("Toggle remains string-only", () => {
  expectTypeOf<() => string>().not.toExtend<ComponentProps<typeof Toggle>["className"]>();
});

it("Field.Content remains string-only", () => {
  expectTypeOf<() => string>().not.toExtend<ComponentProps<typeof Field.Content>["className"]>();
});

it("Dialog.Header remains string-only", () => {
  expectTypeOf<() => string>().not.toExtend<ComponentProps<typeof Dialog.Header>["className"]>();
});
