import { StrictMode, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { render } from "../../../test/browser-render";
import { withLocale } from "../../../test/locale-matrix";
import { fkasPrivate, renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Toast } from "./index";

type ModuleManager = ReturnType<typeof Toast.createToastManager>;

function providerTree(manager: ModuleManager, children: ReactNode = null) {
  return withLocale(
    "en-US",
    <Toast.Provider toastManager={manager} timeout={0}>
      <Toast.Viewport />
      {children}
    </Toast.Provider>
  );
}

function renderProvider(manager: ModuleManager, children: ReactNode = null) {
  return renderThemed(providerTree(manager, children));
}

/** Each toast's accessible name (its title), in DOM order. Every toast here is low priority. */
function toastTitles(): string[] {
  return page
    .getByRole("dialog")
    .elements()
    .map((root) => document.getElementById(root.getAttribute("aria-labelledby") ?? "")?.textContent ?? "");
}

async function expectTitles(expected: string[]): Promise<void> {
  await vi.waitFor(() => {
    expect(toastTitles()).toEqual(expected);
  });
}

function AddOnMount({ manager, title }: { manager: ModuleManager; title: string }) {
  useEffect(() => {
    // StrictMode runs this effect twice; the id upserts both calls into one toast.
    manager.add({ id: title, title });
  }, [manager, title]);
  return null;
}

function HookAddOnMount({ title }: { title: string }) {
  // The hook face rebinds `add` whenever the toast list changes, so a dependency on it
  // would re-add after every toast. The first binding writes to the same store.
  const add = useRef(Toast.useToastManager().add);
  useEffect(() => {
    add.current({ title });
  }, [title]);
  return null;
}

describe("Toast module manager before the provider connects", () => {
  it("shows a toast added before the provider mounts", async () => {
    const manager = Toast.createToastManager();
    const id = manager.add({ title: "Raised before render" });
    expect(id).not.toBe("");

    renderProvider(manager);

    await expectTitles(["Raised before render"]);
  });

  it("shows a toast added in a child's mount effect", async () => {
    const manager = Toast.createToastManager();

    renderProvider(manager, <AddOnMount manager={manager} title="Raised on mount" />);

    await expectTitles(["Raised on mount"]);
  });

  it("replays queued calls before a later sibling's mount effect writes to the store", async () => {
    const manager = Toast.createToastManager();
    manager.add({ title: "Queued first" });

    renderProvider(manager, <HookAddOnMount title="Hook on mount" />);

    // The viewport lists the newest toast first, so call order reads bottom-up.
    await expectTitles(["Hook on mount", "Queued first"]);
  });

  it("replays update and close in call order against ids minted while queued", async () => {
    const manager = Toast.createToastManager();
    const kept = manager.add({ title: "Saving" });
    const dropped = manager.add({ title: "Dropped" });
    manager.update(kept, { title: "Saved" });
    manager.close(dropped);

    renderProvider(manager);

    await expectTitles(["Saved"]);
  });

  it("shows each toast once under StrictMode and auto-dismisses it", async () => {
    const manager = Toast.createToastManager();
    manager.add({ title: "Queued under StrictMode" });

    // StrictMode sits outside every wrapper, so its effect replay reaches the provider,
    // whose replayed cleanup clears the store's timers after the queue has replayed.
    render(
      <StrictMode>
        <ThemeScope theme={fkasPrivate}>
          {withLocale(
            "en-US",
            <Toast.Provider toastManager={manager} timeout={300}>
              <Toast.Viewport />
              <AddOnMount manager={manager} title="Mounted under StrictMode" />
            </Toast.Provider>
          )}
        </ThemeScope>
      </StrictMode>
    );

    await expectTitles(["Mounted under StrictMode", "Queued under StrictMode"]);
    await vi.waitFor(
      () => {
        expect(toastTitles()).toEqual([]);
      },
      { timeout: 3000 }
    );
  });

  it("queues while no provider is mounted and reaches a remounted provider", async () => {
    const manager = Toast.createToastManager();
    const first = renderProvider(manager, <AddOnMount manager={manager} title="First mount" />);
    await expectTitles(["First mount"]);
    first.unmount();

    manager.add({ title: "Raised between mounts" });
    renderProvider(manager, <AddOnMount manager={manager} title="Second mount" />);

    await expectTitles(["Second mount", "Raised between mounts"]);
  });

  it("shows a live add after the provider connects", async () => {
    const manager = Toast.createToastManager();
    renderProvider(manager);

    const id = manager.add({ id: "live", title: "Raised live" });

    expect(id).toBe("live");
    await expectTitles(["Raised live"]);
  });

  it("connects a spread copy of a manager", async () => {
    const manager = { ...Toast.createToastManager() };
    manager.add({ title: "Raised through a copy" });

    renderProvider(manager);

    await expectTitles(["Raised through a copy"]);
  });

  it("keeps both toasts when the provider switches to another manager", async () => {
    const first = Toast.createToastManager();
    const second = Toast.createToastManager();
    first.add({ title: "From the first manager" });
    const view = renderProvider(first);
    await expectTitles(["From the first manager"]);

    view.rerender(providerTree(second));
    second.add({ title: "From the second manager" });

    await expectTitles(["From the second manager", "From the first manager"]);
  });

  it("runs a call made during replay after the calls queued before it", async () => {
    const manager = Toast.createToastManager();
    const later = "later";
    const first = manager.add({
      title: "Closes the later toast",
      onClose: () => {
        manager.close(later);
      },
    });
    manager.close(first);
    manager.add({ id: later, title: "Closed by the first toast" });
    manager.add({ title: "Still open" });

    renderProvider(manager);

    await expectTitles(["Still open"]);
  });
});
