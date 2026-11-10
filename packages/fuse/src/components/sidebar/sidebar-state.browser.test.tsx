import { StrictMode, useLayoutEffect } from "react";

import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { Sidebar, useSidebar } from "@elmeragroup/fuse/sidebar";

import { withLocale } from "../../../test/locale-matrix";
import { setupSidebarBrowser } from "../../../test/sidebar-browser-fixtures";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";

setupSidebarBrowser();

function OpenStatus() {
  const sidebar = useSidebar();
  return <output aria-label="Open state">{String(sidebar.open)}</output>;
}

function QueueControls() {
  const { setOpen } = useSidebar();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((open) => !open);
          setOpen((open) => !open);
        }}>
        Invert twice
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setOpen((open) => !open);
        }}>
        Set then invert
      </button>
      <OpenStatus />
    </>
  );
}

describe("Sidebar committed state and update queue", () => {
  it("composes controlled notifications once and starts the next event from a rejected prop", async () => {
    const onChange = vi.fn<(open: boolean) => void>();
    render(
      withLocale(
        "en-US",
        <StrictMode>
          <Sidebar.Provider open onOpenChange={onChange}>
            <QueueControls />
            <Sidebar.Trigger />
          </Sidebar.Provider>
        </StrictMode>
      )
    );
    await userEvent.click(roleNamed("button", "Invert twice"));
    expect(onChange.mock.calls.map(([open]) => open)).toEqual([false, true]);
    expect(roleNamed("status", "Open state").textContent).toBe("true");
    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps callbacks stable when the committed controlled setter changes", async () => {
    const identities: Array<ReturnType<typeof useSidebar>> = [];
    const first = vi.fn<(open: boolean) => void>();
    const second = vi.fn<(open: boolean) => void>();
    function Probe() {
      const sidebar = useSidebar();
      useLayoutEffect(() => {
        identities.push(sidebar);
      });
      return <Sidebar.Trigger />;
    }
    const field = (onOpenChange: (open: boolean) => void) =>
      withLocale(
        "en-US",
        <Sidebar.Provider open onOpenChange={onOpenChange}>
          <Probe />
        </Sidebar.Provider>
      );
    const { rerender } = render(field(first));
    rerender(field(second));
    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith(false);
    expect(new Set(identities.map((value) => value.setOpen)).size).toBe(1);
    expect(new Set(identities.map((value) => value.toggleSidebar)).size).toBe(1);
  });
});
