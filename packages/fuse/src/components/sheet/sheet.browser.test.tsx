import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { expectTargetBoxes } from "../../../test/target-size";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { DatePicker as RacDatePicker } from "../../react-aria/date-picker";
import { Sheet } from "./index";
import type { SheetRootProps } from "./sheet";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

function BasicSheet({
  onOpenChange,
  side,
  body = "Usage history.",
  ...contentProps
}: {
  onOpenChange?: SheetRootProps["onOpenChange"];
  side?: "top" | "right" | "bottom" | "left";
  body?: ReactNode;
  showCloseButton?: boolean;
  closeLabel?: string;
  size?: "sm" | "md" | "10xl";
}) {
  return (
    <Sheet.Root side={side} onOpenChange={onOpenChange}>
      <Sheet.Trigger>Open details</Sheet.Trigger>
      <Sheet.Content {...contentProps}>
        <Sheet.Header>
          <Sheet.Title>Meter details</Sheet.Title>
          <Sheet.Description>Readings for this address.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Body>{body}</Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close>Done</Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}

/**
 * Lands the panel's slide-in at once. A click on a control inside a panel still travelling from its
 * starting translate is aimed at a box the panel has already left, so the enter transition is run
 * to its end rather than waited out.
 */
async function settleOpen(dialog: HTMLElement): Promise<void> {
  await expect.poll(() => dialog.hasAttribute("data-starting-style")).toBe(false);
  for (const animation of dialog.getAnimations()) animation.finish();
}

async function openSheet(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Open details", exact: true }).element());
  await expect.element(page.getByRole("dialog")).toBeVisible();
  const dialog = page.getByRole("dialog").element();
  if (!(dialog instanceof HTMLElement)) {
    throw new Error("expected the popup");
  }
  await settleOpen(dialog);
  return dialog;
}

describe("Sheet", () => {
  it("opens from the trigger, is named by its Title, and reports open state", async () => {
    const onOpenChange = vi.fn();
    renderThemed(withLocale("en-US", <BasicSheet onOpenChange={onOpenChange} />));

    const dialog = await openSheet();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(page.getByRole("dialog", { name: "Meter details" }).element()).toBe(dialog);
    expect(dialog.getAttribute("data-slot")).toBe("sheet-content");
    expect(dialog.getAttribute("data-side")).toBe("right");

    const description = page.getByText("Readings for this address.", { exact: true }).element();
    expect(dialog.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("keeps the dialog's name, description and role when a wrapper forwards them as undefined", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sheet.Root>
          <Sheet.Trigger>Open details</Sheet.Trigger>
          <Sheet.Content aria-labelledby={undefined} aria-describedby={undefined} role={undefined}>
            <Sheet.Title>Meter details</Sheet.Title>
            <Sheet.Description>Readings for this address.</Sheet.Description>
          </Sheet.Content>
        </Sheet.Root>
      )
    );
    await userEvent.click(page.getByRole("button", { name: "Open details", exact: true }));
    const dialog = page.getByRole("dialog", { name: "Meter details", exact: true });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveAccessibleDescription("Readings for this address.");
  });

  it("maps Root side onto the popup data-side for every edge", async () => {
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const { unmount } = renderThemed(withLocale("en-US", <BasicSheet side={side} />));
      const dialog = await openSheet();
      expect(dialog.getAttribute("data-side"), side).toBe(side);
      unmount();
    }
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderThemed(withLocale("en-US", <BasicSheet />));
    await openSheet();

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Open details", exact: true })).toHaveFocus();
  });

  it("traps focus inside the popup and wraps in both directions", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <button type="button">Behind</button>
          <BasicSheet />
        </>
      )
    );
    const behind = page.getByRole("button", { name: "Behind", exact: true }).element();
    const dialog = await openSheet();
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    const tabbables = [...dialog.querySelectorAll<HTMLElement>("button")];
    expect(tabbables.length).toBeGreaterThan(1);
    const first = tabbables[0];
    const last = tabbables.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error("expected tabbable controls");
    }

    last.focus();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(last);
    });
    await userEvent.keyboard("{Tab}");
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(first);
    });

    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(last);
    });
    expect(behind.contains(document.activeElement)).toBe(false);
  });

  it("closes from the corner button, drops it when showCloseButton is false, and closes from an explicit Sheet.Close", async () => {
    const { rerender } = renderThemed(withLocale("en-US", <BasicSheet />));
    await openSheet();
    const corner = page.getByRole("button", { name: "Close", exact: true }).element();
    expect(corner.getAttribute("data-slot")).toBe("sheet-close");
    expect(corner.querySelector("svg")).not.toBeNull();
    expect(corner.getAttribute("aria-label")).toBe("Close");
    expectTargetBoxes([corner], "corner close");
    await userEvent.click(corner);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

    rerender(withLocale("en-US", <BasicSheet showCloseButton={false} />));
    await openSheet();
    expect(page.getByRole("button", { name: "Close", exact: true }).query()).toBeNull();
    await userEvent.click(roleNamed("button", "Done"));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the corner close button in every locale and lets closeLabel win", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderThemed(withLocale(locale, <BasicSheet />));
      await openSheet();
      expect(
        page.getByRole("button", { name: CLOSE_COPY[locale], exact: true }).element(),
        locale
      ).toBeTruthy();
      unmount();
    }

    const { unmount } = renderThemed(withLocale("nb-NO", <BasicSheet closeLabel="Avslutt" />));
    await openSheet();
    expect(page.getByRole("button", { name: "Avslutt", exact: true }).element()).toBeTruthy();
    expect(page.getByRole("button", { name: "Lukk", exact: true }).query()).toBeNull();
    unmount();
  });

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(withLocale("en-US", <BasicSheet />));
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openSheet();
    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("stays open after a click in the panel closes a React Aria date picker inside it, and after the next click", async () => {
    const onOpenChange = vi.fn<NonNullable<SheetRootProps["onOpenChange"]>>();
    const reported = () => onOpenChange.mock.calls.map(([open, details]) => [open, details.reason]);
    renderThemed(
      withLocale(
        "en-US",
        <BasicSheet onOpenChange={onOpenChange} body={<RacDatePicker label="Reading date" />} />
      )
    );
    await openSheet();
    await userEvent.click(page.getByRole("button", { name: /^calendar/i }));
    await expect.element(page.getByRole("grid")).toBeVisible();

    // React Aria's modal popover inerts the panel, so the press lands where the user aims rather
    // than where an actionability check would accept it. React Aria stops this click at document
    // capture, before Base UI's outside-press check on its target can run.
    const description = page.getByText("Readings for this address.", { exact: true });
    await userEvent.click(description, { force: true });
    await expect.element(page.getByRole("grid")).not.toBeInTheDocument();
    expect(reported()).toEqual([[true, "trigger-press"]]);

    // Unforced, so the press waits until the panel takes pointer input again. Base UI reports a
    // dismissal from inside the click, so it has been recorded by the time the click resolves.
    await userEvent.click(description);
    expect(reported()).toEqual([[true, "trigger-press"]]);
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <button type="button">Before</button>
          <BasicSheet />
        </>
      )
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const trigger = page.getByRole("button", { name: "Open details", exact: true }).element();
    if (!(previous instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
      throw new Error("expected buttons");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });
});
