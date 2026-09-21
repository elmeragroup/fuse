import type { ComponentProps, ElementType } from "react";

import { expectTypeOf, it } from "vitest";

import type { Avatar } from "@elmeragroup/fuse/avatar";
import type { Button } from "@elmeragroup/fuse/button";
import type { ButtonGroup } from "@elmeragroup/fuse/button-group";
import type { Checkbox } from "@elmeragroup/fuse/checkbox";
import type { Collapsible } from "@elmeragroup/fuse/collapsible";
import type { Combobox } from "@elmeragroup/fuse/combobox";
import type { Dialog } from "@elmeragroup/fuse/dialog";
import type { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import type { Field } from "@elmeragroup/fuse/field";
import type { Item } from "@elmeragroup/fuse/item";
import type { Popover } from "@elmeragroup/fuse/popover";
import type { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import type { Select } from "@elmeragroup/fuse/select";
import type { Separator } from "@elmeragroup/fuse/separator";
import type { Sheet } from "@elmeragroup/fuse/sheet";
import type { Sidebar } from "@elmeragroup/fuse/sidebar";
import type { Tabs } from "@elmeragroup/fuse/tabs";
import type { Toast } from "@elmeragroup/fuse/toast";
import type { Toggle } from "@elmeragroup/fuse/toggle";
import type { Tooltip } from "@elmeragroup/fuse/tooltip";

/**
 * className contracts: a part either keeps Base UI's
 * string-or-state-callback union or is deliberately narrowed to a string. Each line below is
 * one part, so a failing assertion names the part in its line number.
 */
type ClassNameOf<Part extends ElementType> = ComponentProps<Part>["className"];
type StateCallback = (...args: never[]) => string | undefined;
type AcceptsString<Part extends ElementType> = string extends ClassNameOf<Part> ? true : false;
type AcceptsStateCallback<Part extends ElementType> = [Extract<ClassNameOf<Part>, StateCallback>] extends [
  never,
]
  ? false
  : true;
/** `"both"` keeps string and state-callback classes; `"string"` is string-only. */
type ClassNameContract<Part extends ElementType> =
  AcceptsString<Part> extends true ? (AcceptsStateCallback<Part> extends true ? "both" : "string") : never;

it("state-class parts preserve string and state-callback classes", () => {
  expectTypeOf<ClassNameContract<typeof Dialog.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Dialog.Close>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Dialog.Overlay>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Dialog.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Dialog.Title>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Dialog.Description>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Separator>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Item.Separator>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Avatar.Root>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Avatar.Image>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Avatar.Fallback>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof ButtonGroup.Separator>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Field.Root>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Field.Set>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Field.Legend>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Field.Label>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Field.Description>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Field.Error>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Checkbox>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Collapsible.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Clear>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.List>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Item>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Group>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Label>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Empty>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Separator>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Chips>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.Chip>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Combobox.ChipsInput>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.SubContent>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.Label>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.Item>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.LinkItem>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.CheckboxItem>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.RadioItem>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.Separator>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof DropdownMenu.SubTrigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Popover.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Popover.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Popover.Title>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Popover.Description>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof ScrollArea.Root>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof ScrollArea.Bar>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.Value>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.Item>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.Group>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.Label>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.Separator>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.ScrollUpButton>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Select.ScrollDownButton>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Sheet.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Sheet.Close>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Sheet.Overlay>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Sheet.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Sheet.Title>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Sheet.Description>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Tooltip.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Tooltip.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Sidebar.Separator>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Tabs.Root>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Tabs.List>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Tabs.Trigger>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Tabs.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Toast.Viewport>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Toast.Root>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Toast.Content>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Toast.Title>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Toast.Description>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Toast.Action>>().toEqualTypeOf<"both">();
  expectTypeOf<ClassNameContract<typeof Toast.Close>>().toEqualTypeOf<"both">();
});

it("narrowed parts remain string-only", () => {
  expectTypeOf<ClassNameContract<typeof Combobox.Input>>().toEqualTypeOf<"string">();
  expectTypeOf<ClassNameContract<typeof Button>>().toEqualTypeOf<"string">();
  expectTypeOf<ClassNameContract<typeof Toggle>>().toEqualTypeOf<"string">();
  expectTypeOf<ClassNameContract<typeof Field.Content>>().toEqualTypeOf<"string">();
  expectTypeOf<ClassNameContract<typeof Dialog.Header>>().toEqualTypeOf<"string">();
});
