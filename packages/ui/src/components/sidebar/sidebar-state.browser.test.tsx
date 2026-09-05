import { startTransition, StrictMode, Suspense, use, useLayoutEffect, useState } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Sidebar, useSidebar } from "@elmeragroup/ui/sidebar";

import { withLocale } from "../../../test/locale-matrix";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";

beforeEach(async () => {
  await page.viewport(1280, 900);
});

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
  it.each(["Invert twice", "Set then invert"])(
    "composes %s and writes each request once in StrictMode",
    async (button) => {
      render(
        withLocale(
          "en-US",
          <StrictMode>
            <Sidebar.Provider>
              <QueueControls />
            </Sidebar.Provider>
          </StrictMode>
        )
      );
      const cookie = vi.spyOn(document, "cookie", "set");
      try {
        await userEvent.click(roleNamed("button", button));
        expect(roleNamed("status", "Open state").textContent).toBe("true");
        expect(cookie.mock.calls.map(([value]) => value)).toEqual([
          "sidebar:state=false; path=/; max-age=604800",
          "sidebar:state=true; path=/; max-age=604800",
        ]);
      } finally {
        cookie.mockRestore();
      }
    }
  );

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

  it.each([false, true])(
    "uses committed state and callback during a suspended transition, abandoned: %s",
    async (abandon) => {
      const committedChange = vi.fn<(open: boolean) => void>();
      const pendingChange = vi.fn<(open: boolean) => void>();
      let suspended = false;
      const never = new Promise<void>(() => undefined);
      function Pending({ active }: { active: boolean }) {
        if (active) {
          suspended = true;
          use(never);
        }
        return null;
      }
      function Parent() {
        const [pending, setPending] = useState(false);
        return (
          <>
            <button type="button" onClick={() => startTransition(() => setPending(true))}>
              Start pending close
            </button>
            <button type="button" onClick={() => setPending(false)}>
              Abandon
            </button>
            <Suspense fallback={<span>Waiting</span>}>
              <Sidebar.Provider open={!pending} onOpenChange={pending ? pendingChange : committedChange}>
                <OpenStatus />
                <Sidebar.Trigger />
                <Pending active={pending} />
              </Sidebar.Provider>
            </Suspense>
          </>
        );
      }
      render(withLocale("en-US", <Parent />));
      await userEvent.click(roleNamed("button", "Start pending close"));
      await expect.poll(() => suspended).toBe(true);
      expect(roleNamed("status", "Open state").textContent).toBe("true");
      if (abandon) await userEvent.click(roleNamed("button", "Abandon"));
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
      expect(committedChange).toHaveBeenCalledExactlyOnceWith(false);
      expect(pendingChange).not.toHaveBeenCalled();
    }
  );

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
