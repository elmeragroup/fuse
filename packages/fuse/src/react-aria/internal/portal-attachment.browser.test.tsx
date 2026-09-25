import { StrictMode, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { CalendarDate } from "@internationalized/date";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "../../../test/browser-render";
import { fkasPrivate as theme } from "../../../test/themed-browser-render";
import { Popover } from "../../components/popover";
import { ThemeScope } from "../../theme/theme-scope";
import { useResolvedPortalContainer } from "../../theme/theme-scope-container";
import { DatePicker } from "../date-picker/date-picker";
import { UiProviders } from "../ui-providers/ui-providers";

function Calendar({ container }: { container?: HTMLElement | RefObject<HTMLElement | null> }) {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DatePicker
        label="Date"
        defaultOpen
        defaultValue={new CalendarDate(2026, 7, 14)}
        container={container}
      />
    </UiProviders>
  );
}

function Popup({ container }: { container?: HTMLElement | RefObject<HTMLElement | null> }) {
  return (
    <Popover.Root defaultOpen>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content container={container}>
        <Popover.Title>Attached popup</Popover.Title>
      </Popover.Content>
    </Popover.Root>
  );
}

describe("portal attachment", () => {
  for (const kind of ["calendar", "base-ui"] as const) {
    it(`${kind} follows a sibling ref attachment without a host rerender`, async () => {
      const resolutions: (HTMLElement | null | undefined)[] = [];
      function Observe({ container }: { container: RefObject<HTMLElement | null> }): ReactNode {
        resolutions.push(useResolvedPortalContainer(container));
        return null;
      }
      function Host() {
        const container = useRef<HTMLDivElement>(null);
        return (
          <>
            <Observe container={container} />
            {kind === "calendar" ? <Calendar container={container} /> : <Popup container={container} />}
            <div ref={container} data-testid="target" />
          </>
        );
      }
      const { host } = render(
        <StrictMode>
          <Host />
        </StrictMode>
      );
      const dialog = page.getByRole("dialog", { name: kind === "calendar" ? /calendar/i : "Attached popup" });
      await expect.element(dialog).toBeVisible();
      expect(host.querySelector('[data-testid="target"]')?.contains(dialog.element())).toBe(true);
      expect(resolutions[0]).toBeNull();
      expect(resolutions).not.toContain(undefined);
      expect(resolutions.at(-1)).toBe(host.querySelector('[data-testid="target"]'));
    });
  }

  it("leaves a never-attached explicit ref pending inside a scope", async () => {
    render(
      <ThemeScope theme={theme}>
        <Calendar container={{ current: null }} />
        <Popup container={{ current: null }} />
      </ThemeScope>
    );
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders into an already attached explicit element", async () => {
    const target = document.createElement("section");
    document.body.append(target);
    try {
      const { unmount } = render(<Calendar container={target} />);
      await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
      expect(target.contains(page.getByRole("dialog", { name: /calendar/i }).element())).toBe(true);
      unmount();
    } finally {
      target.remove();
    }
  });

  it("uses the primitive fallback without a target or scope", async () => {
    const { host } = render(<Calendar />);
    const dialog = page.getByRole("dialog", { name: /calendar/i });
    await expect.element(dialog).toBeVisible();
    expect(document.body.contains(dialog.element())).toBe(true);
    expect(host.contains(dialog.element())).toBe(false);
  });

  it("uses the nearest ThemeScope target", async () => {
    const { host } = render(
      <ThemeScope theme={theme}>
        <ThemeScope theme={{ ...theme, brand: "tkas" }}>
          <Calendar />
        </ThemeScope>
      </ThemeScope>
    );
    const dialog = page.getByRole("dialog", { name: /calendar/i });
    await expect.element(dialog).toBeVisible();
    expect(host.querySelector('[data-theme-brand="tkas"]')?.contains(dialog.element())).toBe(true);
  });
});
