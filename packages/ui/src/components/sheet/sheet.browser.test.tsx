import { useRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { px, renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Sheet } from "./sheet";

/** Reads a theme token off the document root (`--container-*` are rem lengths). */
function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * The block a `position: fixed` percentage resolves against — the initial containing
 * block, which excludes any classic scrollbar. `window.innerWidth` includes it, so it is
 * off by the scrollbar width on the rungs where `90%` is the smaller half of the `min()`.
 */
function initialContainingBlockWidth(): number {
  return document.documentElement.clientWidth;
}

/** The panel's content box — `max-width` caps that box, and the side border is outside it. */
function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return element.getBoundingClientRect().width - px(style.borderLeftWidth) - px(style.borderRightWidth);
}

function remToPx(value: string): number {
  return px(value) * px(getComputedStyle(document.documentElement).fontSize);
}

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

function BasicSheet({
  onOpenChange,
  side,
  ...contentProps
}: {
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
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
        <Sheet.Body>Usage history.</Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close>Done</Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}

/** One animation frame, so the settled-open wait can compare geometry across frames. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function boxOf(element: HTMLElement): string {
  const { x, y, width, height } = element.getBoundingClientRect();
  return `${x}:${y}:${width}:${height}`;
}

/**
 * Wait until the panel has stopped sliding in.
 *
 * Base UI drops `data-starting-style` one frame after the popup mounts, but the panel is
 * still parked at that starting translate when the trigger click resolves — the 200 ms
 * `transition-transform` in sheet.tsx has only just begun (measured: `translateX(415px)`,
 * a whole panel width off-screen, for the default right-hand sheet). A click on a control
 * inside a panel that is still travelling is aimed at a box the panel has already left:
 * under load such a click was seen to resolve without a single pointer event reaching the
 * control, so nothing closed and the popup kept `data-open` until the close assertion ran
 * out of patience. Two frames with an unchanged box mean the transform has landed.
 */
async function settleOpen(dialog: HTMLElement): Promise<void> {
  await vi.waitFor(
    async () => {
      expect(dialog.hasAttribute("data-starting-style")).toBe(false);
      const before = boxOf(dialog);
      await nextFrame();
      expect(boxOf(dialog)).toBe(before);
    },
    // Ten times the 200 ms enter transition in sheet.tsx, so a CPU-loaded run that drops
    // frames still settles well inside the wait.
    { timeout: 2000 }
  );
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
    const trigger = page.getByRole("button", { name: "Open details", exact: true }).element();
    await openSheet();

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
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
    expect(dialog.contains(document.activeElement)).toBe(true);

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

  it("closes from the corner button and drops it when showCloseButton is false", async () => {
    const { rerender } = renderThemed(withLocale("en-US", <BasicSheet />));
    await openSheet();
    const corner = page.getByRole("button", { name: "Close", exact: true }).element();
    expect(corner.getAttribute("data-slot")).toBe("sheet-close");
    expect(corner.querySelector("svg")).not.toBeNull();
    expect(corner.getAttribute("aria-label")).toBe("Close");
    expect(corner.className).toContain("hit-area-1");
    await userEvent.click(corner);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

    rerender(withLocale("en-US", <BasicSheet showCloseButton={false} />));
    await openSheet();
    expect(page.getByRole("button", { name: "Close", exact: true }).query()).toBeNull();
    expect(page.getByRole("button", { name: "Done", exact: true }).element()).toBeTruthy();
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

  it("closes from an explicit Sheet.Close", async () => {
    renderThemed(withLocale("en-US", <BasicSheet showCloseButton={false} />));
    await openSheet();
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }).element());
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps Body as the scroll container and stamps the layout slots", async () => {
    renderThemed(withLocale("en-US", <BasicSheet />));
    const dialog = await openSheet();
    const body = dialog.querySelector("[data-slot=sheet-body]");
    expect(body).not.toBeNull();
    expect(body?.className).toContain("overflow-y-auto");
    expect(body?.className).toContain("min-h-0");
    expect(body?.className).toContain("flex-1");
    expect(document.querySelector("[data-slot=sheet-viewport]")).not.toBeNull();
    expect(dialog.querySelector("[data-slot=sheet-content-inner]")).not.toBeNull();
    expect(dialog.querySelector("[data-slot=sheet-header]")).not.toBeNull();
    expect(dialog.querySelector("[data-slot=sheet-footer]")).not.toBeNull();
    expect(dialog.querySelector("[data-slot=sheet-title]")).not.toBeNull();
    expect(dialog.querySelector("[data-slot=sheet-description]")).not.toBeNull();
  });

  it("resolves the size axis to the side-gated used max-width on both gated sides", async () => {
    // Asserts the used value the panel is actually capped at, not the class spelling:
    // the axis moves through `--overlay-width`, so a rung is only correct if the two
    // side-gated `max-w-(--overlay-width)` consumers resolve it (sheet.md §4, §8.13).
    const cases = [
      { size: undefined, cap: () => remToPx(readToken("--container-md")) },
      { size: "sm", cap: () => remToPx(readToken("--container-sm")) },
      { size: "10xl", cap: () => 1920 },
    ] as const;

    await page.viewport(1024, 768);
    for (const side of ["right", "left"] as const) {
      for (const { size, cap } of cases) {
        const { unmount } = renderThemed(withLocale("en-US", <BasicSheet side={side} size={size} />));
        const dialog = await openSheet();
        expect(contentWidth(dialog), `${side}/${String(size)}`).toBeCloseTo(
          Math.min(cap(), initialContainingBlockWidth() * 0.9),
          0
        );
        unmount();
      }
    }
  });

  it("leaves the size axis inert on the top and bottom sides", async () => {
    await page.viewport(1024, 768);
    for (const side of ["top", "bottom"] as const) {
      const { unmount } = renderThemed(withLocale("en-US", <BasicSheet side={side} size="sm" />));
      const dialog = await openSheet();
      expect(getComputedStyle(dialog).maxWidth, side).toBe("none");
      unmount();
    }
  });

  it("leaves the size axis inert below the sm breakpoint, where the panel is full-width", async () => {
    // The `sm:` half of the gate: `size` only caps a left/right panel once the viewport
    // is wide enough, and `w-full` owns the width below that (sheet.md §4).
    await page.viewport(500, 768);
    const { unmount } = renderThemed(withLocale("en-US", <BasicSheet side="right" size="sm" />));
    const dialog = await openSheet();
    expect(getComputedStyle(dialog).maxWidth).toBe("none");
    expect(contentWidth(dialog)).toBeCloseTo(initialContainingBlockWidth(), 0);
    unmount();
    await page.viewport(1024, 768);
  });

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(withLocale("en-US", <BasicSheet />));
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openSheet();
    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("waits while the resolved container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <Sheet.Root open>
          <Sheet.Content container={ref}>
            <Sheet.Title>Pending</Sheet.Title>
          </Sheet.Content>
        </Sheet.Root>
      );
    }
    renderThemed(withLocale("en-US", <NeverAttached />));

    expect(page.getByRole("dialog").query()).toBeNull();
    expect(document.querySelector("[data-slot=sheet-content]")).toBeNull();
    expect(document.querySelector("[data-slot=sheet-overlay]")).toBeNull();
  });

  it("does not paint the popup outside a ThemeScope element that has not attached yet", () => {
    renderThemed(
      withLocale(
        "en-US",
        <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
          <Sheet.Root open>
            <Sheet.Content>
              <Sheet.Title>Scoped</Sheet.Title>
            </Sheet.Content>
          </Sheet.Root>
        </ThemeScope>
      )
    );
    const dialog = page.getByRole("dialog").element();
    const scope = dialog.closest("[data-theme-variant=external]");
    expect(scope).not.toBeNull();
    expect([...document.body.children].includes(dialog)).toBe(false);
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
