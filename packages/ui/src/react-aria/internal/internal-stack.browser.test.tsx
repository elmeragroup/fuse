import { useRef } from "react";
import type { ReactElement } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { buttonVariants } from "../../components/button/button-variants";
import { ThemeScope } from "../../theme/theme-scope";
import { Button } from "./button";
import { Dialog, DialogTrigger } from "./dialog";
import { FieldGroup, Input, Label } from "./field";
import { Modal, shouldCloseForInteraction } from "./modal";
import { OVERLAY_CONTAINER_ATTR, OVERLAY_CONTAINER_POPOVER_SELECTOR } from "./overlay-container";
import { Popover, PopoverTrigger } from "./popover";

function recipeClasses(rendered: string): string[] {
  return rendered.split(/\s+/u).filter(Boolean);
}

describe("the internal RAC Button", () => {
  it("renders the public buttonVariants classes for the requested variant and size", () => {
    renderThemed(
      <Button aria-label="Calendar" size="icon-sm" variant="ghost">
        <span aria-hidden="true">…</span>
      </Button>
    );
    const trigger = page.getByRole("button", { name: "Calendar" }).element();

    expect(trigger.getAttribute("data-slot")).toBe("button");
    for (const className of recipeClasses(buttonVariants({ variant: "ghost", size: "icon-sm" }))) {
      expect(trigger.classList.contains(className), `missing ${className}`).toBe(true);
    }
  });

  it("keeps caller classes on top of the borrowed recipe", () => {
    renderThemed(<Button className="mt-4">Next month</Button>);
    const trigger = page.getByRole("button", { name: "Next month" }).element();

    expect(trigger.classList.contains("mt-4")).toBe(true);
    expect(trigger.classList.contains("h-(--control-h-md)")).toBe(true);
  });

  it("stays a real RAC button that reports presses", async () => {
    const onPress = vi.fn();
    renderThemed(<Button onPress={onPress}>Apply</Button>);
    await userEvent.click(page.getByRole("button", { name: "Apply" }).element());

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("the internal field chrome", () => {
  it("names the grouped control and reflects RAC group state", async () => {
    renderThemed(
      <>
        <Label id="from-label">From</Label>
        <FieldGroup aria-labelledby="from-label">
          <Input aria-label="From" />
        </FieldGroup>
      </>
    );
    const group = page.getByRole("group", { name: "From" }).element();

    expect(group.getAttribute("data-slot")).toBe("field-group");
    expect(group.classList.contains("h-(--control-h-md)")).toBe(true);

    await userEvent.click(page.getByRole("textbox", { name: "From" }).element());
    expect(group.hasAttribute("data-focus-within")).toBe(true);
  });

  it("marks an invalid group with the error token, never destructive", () => {
    renderThemed(
      <FieldGroup aria-label="Due date" isInvalid>
        <Input aria-label="Due date" />
      </FieldGroup>
    );
    const group = page.getByRole("group", { name: "Due date" }).element();

    expect(group.classList.contains("border-error")).toBe(true);
    expect(group.className).not.toContain("destructive");
  });
});

function PopoverFixture({ container }: { container?: React.RefObject<HTMLElement | null> }): ReactElement {
  return (
    <PopoverTrigger>
      <Button>Choose date</Button>
      <Popover container={container}>
        <Dialog closeButton={false} title="Calendar">
          <button type="button">Inside the popover</button>
        </Dialog>
      </Popover>
    </PopoverTrigger>
  );
}

async function openPopover(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Choose date" }).element());
  const dialog = page.getByRole("dialog").element();
  if (!(dialog instanceof HTMLElement)) {
    throw new Error("expected the popover dialog");
  }
  return dialog;
}

describe("the internal RAC Popover", () => {
  it("stamps the overlay-container attribute the modal seam looks for", async () => {
    renderThemed(withLocale("en-US", <PopoverFixture />));
    const dialog = await openPopover();
    const popover = dialog.closest(OVERLAY_CONTAINER_POPOVER_SELECTOR);

    expect(popover).not.toBeNull();
    expect(popover?.getAttribute(OVERLAY_CONTAINER_ATTR)).toBe("popover");
  });

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(withLocale("en-US", <PopoverFixture />));
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openPopover();

    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("waits while the resolved container element is still null", async () => {
    function NeverAttached(): ReactElement {
      const ref = useRef<HTMLElement | null>(null);
      return <PopoverFixture container={ref} />;
    }
    renderThemed(withLocale("en-US", <NeverAttached />));
    await userEvent.click(page.getByRole("button", { name: "Choose date" }).element());

    expect(page.getByRole("dialog").query()).toBeNull();
    expect(document.querySelector(OVERLAY_CONTAINER_POPOVER_SELECTOR)).toBeNull();
  });

  it("does not escape a ThemeScope element that has not attached yet", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
          <PopoverFixture />
        </ThemeScope>
      )
    );
    const dialog = await openPopover();

    expect(dialog.closest("[data-theme-variant=external]")).not.toBeNull();
    expect([...document.body.children].includes(dialog)).toBe(false);
  });
});

describe("the internal RAC Modal", () => {
  it("keeps its host open when the interaction landed inside a private popover", async () => {
    const onOpenChange = vi.fn();
    renderThemed(
      withLocale(
        "en-US",
        <Modal isDismissable isOpen onOpenChange={onOpenChange}>
          <Dialog closeButton={false} title="Order">
            <PopoverFixture />
          </Dialog>
        </Modal>
      )
    );

    await userEvent.click(page.getByRole("button", { name: "Choose date" }).element());
    await userEvent.click(page.getByRole("button", { name: "Inside the popover" }).element());

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("short-circuits before the caller's own predicate for popover interactions", async () => {
    const shouldCloseOnInteractOutside = vi.fn(() => true);
    renderThemed(
      withLocale(
        "en-US",
        <Modal isDismissable isOpen shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}>
          <Dialog closeButton={false} title="Order">
            <PopoverFixture />
          </Dialog>
        </Modal>
      )
    );

    await userEvent.click(page.getByRole("button", { name: "Choose date" }).element());
    await userEvent.click(page.getByRole("button", { name: "Inside the popover" }).element());

    expect(shouldCloseOnInteractOutside).not.toHaveBeenCalled();
  });

  it("refuses to dismiss for anything inside a stamped popover, and delegates otherwise", () => {
    const delegate = vi.fn(() => true);
    const popover = document.createElement("div");
    popover.setAttribute(OVERLAY_CONTAINER_ATTR, "popover");
    const inside = document.createElement("button");
    popover.append(inside);
    const outside = document.createElement("button");

    expect(shouldCloseForInteraction(inside, delegate)).toBe(false);
    expect(delegate).not.toHaveBeenCalled();

    expect(shouldCloseForInteraction(outside, delegate)).toBe(true);
    expect(delegate).toHaveBeenCalledWith(outside);
  });

  it("dismisses by default when no caller predicate is supplied", () => {
    const outside = document.createElement("button");
    expect(shouldCloseForInteraction(outside, undefined)).toBe(true);
  });
});

describe("the internal styled Dialog", () => {
  it("labels its dismiss affordance from the locked dialog.close dictionary", async () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <DialogTrigger defaultOpen>
          <Button>Open</Button>
          <Popover>
            <Dialog title="Kalender" />
          </Popover>
        </DialogTrigger>
      )
    );
    const close = page.getByRole("button", { name: "Lukk" }).element();

    expect(close).not.toBeNull();
    await userEvent.click(close);
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("omits the affordance entirely when closeButton is false", () => {
    renderThemed(
      withLocale(
        "en-US",
        <DialogTrigger defaultOpen>
          <Button>Open</Button>
          <Popover>
            <Dialog closeButton={false} title="Calendar" />
          </Popover>
        </DialogTrigger>
      )
    );

    expect(page.getByRole("button", { name: "Close" }).query()).toBeNull();
  });

  it("renders no header row without a title, so RAC's context name reaches the dialog", async () => {
    const titled = renderThemed(
      withLocale(
        "en-US",
        <DialogTrigger defaultOpen>
          <Button>Open</Button>
          <Popover>
            <Dialog closeButton={false} title="Calendar" />
          </Popover>
        </DialogTrigger>
      )
    );
    const withTitle = page.getByRole("dialog").element();

    expect(withTitle.querySelector("[data-slot=dialog-header]")).not.toBeNull();
    await expect.element(page.getByRole("dialog", { name: "Calendar" })).toBeVisible();
    titled.unmount();

    renderThemed(
      withLocale(
        "en-US",
        <DialogTrigger defaultOpen>
          <Button>Open</Button>
          <Popover>
            <Dialog closeButton={false}>
              <button type="button">Inside the dialog</button>
            </Dialog>
          </Popover>
        </DialogTrigger>
      )
    );
    const untitled = page.getByRole("dialog").element();

    // No header element at all — not an empty one. An empty `<Heading slot="title">`
    // would resolve RAC's title slot and become the dialog's accessible name; with the
    // slot unclaimed, the name `DialogTrigger` publishes on `DialogContext` (the
    // trigger's own copy) reaches the overlay instead.
    expect(untitled.querySelector("[data-slot=dialog-header]")).toBeNull();
    expect(untitled.querySelector("[data-slot=dialog-content]")?.firstElementChild).toBe(
      page.getByRole("button", { name: "Inside the dialog" }).element()
    );
    await expect.element(page.getByRole("dialog", { name: "Open" })).toBeVisible();
  });
});
