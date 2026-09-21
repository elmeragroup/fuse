import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Collapsible } from "@elmeragroup/fuse/collapsible";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Field } from "@elmeragroup/fuse/field";
import { Popover } from "@elmeragroup/fuse/popover";
import { Select } from "@elmeragroup/fuse/select";
import { Separator } from "@elmeragroup/fuse/separator";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import "../../dist/styles.css";
import { withLocale } from "../../test/locale-matrix";
import { renderThemed as render, roleNamed } from "../../test/themed-browser-render";

function expectClasses(element: HTMLElement, ...classes: string[]) {
  for (const name of classes) expect(element.classList.contains(name), name).toBe(true);
}

describe("primitive className contracts", () => {
  it("evaluates Checkbox checked state while retaining defaults and string classes", async () => {
    const field = (callback: boolean) =>
      withLocale(
        "en-US",
        <Checkbox
          aria-label="Accept"
          className={
            callback ? (state) => (state.checked ? "user-checked" : "user-unchecked") : "user-string"
          }
        />
      );
    const { rerender } = render(field(true));
    expectClasses(roleNamed("checkbox", "Accept"), "user-unchecked", "bg-card", "border-input");
    await userEvent.click(roleNamed("checkbox", "Accept"));
    expectClasses(roleNamed("checkbox", "Accept"), "user-checked", "bg-card", "border-input");
    expect(roleNamed("checkbox", "Accept").classList.contains("user-unchecked")).toBe(false);
    rerender(field(false));
    expectClasses(roleNamed("checkbox", "Accept"), "user-string", "bg-card", "border-input");
  });

  it("passes live disclosure and tab state to their callbacks", async () => {
    render(
      withLocale(
        "en-US",
        <>
          <Collapsible.Root>
            <Collapsible.Trigger className={(state) => (state.open ? "user-open" : "user-closed")}>
              Details
            </Collapsible.Trigger>
            <Collapsible.Content>More</Collapsible.Content>
          </Collapsible.Root>
          <Tabs.Root defaultValue="a">
            <Tabs.List aria-label="Sections">
              <Tabs.Trigger value="a" className={(state) => (state.active ? "user-active" : "user-inactive")}>
                Alpha
              </Tabs.Trigger>
              <Tabs.Trigger value="b">Beta</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="a">Alpha body</Tabs.Content>
            <Tabs.Content value="b">Beta body</Tabs.Content>
          </Tabs.Root>
        </>
      )
    );
    expectClasses(roleNamed("button", "Details"), "user-closed");
    await userEvent.click(roleNamed("button", "Details"));
    expectClasses(roleNamed("button", "Details"), "user-open");
    expectClasses(roleNamed("tab", "Alpha"), "user-active", "font-medium");
    await userEvent.click(roleNamed("tab", "Beta"));
    expectClasses(roleNamed("tab", "Alpha"), "user-inactive", "font-medium");
  });

  it("merges callbacks for input and overlay triggers across affected families", () => {
    render(
      withLocale(
        "en-US",
        <>
          <Select.Root>
            <Select.Trigger aria-label="Select" className={() => "user-select"}>
              <Select.Value />
            </Select.Trigger>
          </Select.Root>
          <Combobox.Root>
            <Combobox.Trigger aria-label="Combobox" className={() => "user-combobox"}>
              Combobox
            </Combobox.Trigger>
          </Combobox.Root>
          <Dialog.Root>
            <Dialog.Trigger className={() => "user-dialog"}>Dialog</Dialog.Trigger>
          </Dialog.Root>
          <Sheet.Root>
            <Sheet.Trigger className={() => "user-sheet"}>Sheet</Sheet.Trigger>
          </Sheet.Root>
          <Popover.Root>
            <Popover.Trigger className={() => "user-popover"}>Popover</Popover.Trigger>
          </Popover.Root>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={() => "user-menu"}>Menu</DropdownMenu.Trigger>
          </DropdownMenu.Root>
          <Tooltip.Root>
            <Tooltip.Trigger className={() => "user-tooltip"}>Tooltip</Tooltip.Trigger>
          </Tooltip.Root>
        </>
      )
    );
    expectClasses(roleNamed("combobox", "Select"), "user-select", "bg-card");
    expectClasses(roleNamed("combobox", "Combobox"), "user-combobox");
    for (const name of ["Dialog", "Sheet", "Popover", "Menu", "Tooltip"])
      expectClasses(roleNamed("button", name), `user-${name.toLowerCase()}`);
  });

  it("evaluates structural state and preserves each required default", () => {
    render(
      withLocale(
        "en-US",
        <>
          <Avatar.Root
            role="img"
            aria-label="Profile"
            className={(state) => `avatar-${state.imageLoadingStatus}`}>
            <Avatar.Fallback>AB</Avatar.Fallback>
          </Avatar.Root>
          <Field.Root
            role="group"
            aria-label="Locked field"
            disabled
            className={(state) => (state.disabled ? "user-disabled" : "user-enabled")}>
            <Field.Control />
          </Field.Root>
          <Separator
            orientation="vertical"
            aria-label="Divider"
            className={(state) => `separator-${state.orientation}`}
          />
        </>
      )
    );
    expectClasses(roleNamed("img", "Profile"), "avatar-idle", "bg-muted");
    expectClasses(roleNamed("group", "Locked field"), "user-disabled", "flex");
    expectClasses(roleNamed("separator", "Divider"), "separator-vertical", "bg-border");
  });
});
