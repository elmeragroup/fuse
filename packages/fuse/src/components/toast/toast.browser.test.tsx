import { useState } from "react";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; styles.css defines none of them.
import "../../../dist/themes.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  cssVarColor,
  fkasPrivate,
  renderThemed,
  roleNamed,
  snapshotDocumentTheme,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { Dialog } from "../dialog/index";
import { Sheet } from "../sheet/index";
import { Toast } from "./index";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

function renderToast(
  node: ReactNode = <Toast.Viewport />,
  options: {
    locale?: (typeof SUPPORTED_LOCALES)[number];
    manager?: ReturnType<typeof Toast.createToastManager>;
    limit?: number;
  } = {}
) {
  const manager = options.manager ?? Toast.createToastManager();
  const result = renderThemed(
    withLocale(
      options.locale ?? "en-US",
      <Toast.Provider toastManager={manager} timeout={0} limit={options.limit}>
        {node}
      </Toast.Provider>
    )
  );
  return { ...result, manager };
}

function queryToastCopy(name: string): HTMLElement | undefined {
  const copy = page
    .getByText(name, { exact: true })
    .elements()
    .find((node) => node.closest('[role="dialog"], [role="alertdialog"]'));
  return copy instanceof HTMLElement ? copy : undefined;
}

function toastCopy(name: string): HTMLElement {
  const copy = queryToastCopy(name);
  if (copy === undefined) {
    throw new Error(`expected toast copy ${name}`);
  }
  return copy;
}

function toastRootNamed(name: string): HTMLElement {
  const copy = toastCopy(name);
  const root = copy.closest('[role="dialog"], [role="alertdialog"]');
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected toast root for ${name}`);
  }
  return root;
}

function toastRoots(): HTMLElement[] {
  return [...page.getByRole("dialog").elements(), ...page.getByRole("alertdialog").elements()].filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );
}

async function waitForToast(name: string): Promise<HTMLElement> {
  await vi.waitFor(() => {
    expect(queryToastCopy(name)).toBeTruthy();
  });
  return toastRootNamed(name);
}

async function waitForToastGone(name: string): Promise<void> {
  await vi.waitFor(() => {
    expect(queryToastCopy(name)).toBeUndefined();
  });
}

async function expandViewport(): Promise<HTMLElement> {
  const viewport = page.getByRole("region", { name: "Notifications", exact: true }).element();
  if (!(viewport instanceof HTMLElement)) {
    throw new Error("expected the toast viewport");
  }
  await userEvent.keyboard("{F6}");
  return viewport;
}

function LabelledClose({ close }: { close: ReactNode }) {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Viewport>
      {toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast}>
          <Toast.Title />
          {close}
        </Toast.Root>
      ))}
    </Toast.Viewport>
  );
}

describe("Toast manager", () => {
  it("add returns an id, upserts by id, update swaps copy, and close removes one or all", async () => {
    const { manager } = renderToast();

    const first = manager.add({ id: "save", title: "Saving…", description: "Please wait.", timeout: 0 });
    expect(first).toBe("save");
    await waitForToast("Saving…");
    expect(queryToastCopy("Please wait.")).toBeTruthy();

    const upserted = manager.add({ id: "save", title: "Saved", description: "Changes stored.", timeout: 0 });
    expect(upserted).toBe("save");
    await waitForToast("Saved");
    expect(queryToastCopy("Saving…")).toBeUndefined();
    expect(toastRoots()).toHaveLength(1);

    manager.update("save", { description: "All good." });
    await vi.waitFor(() => {
      expect(queryToastCopy("All good.")).toBeTruthy();
    });

    const extra = manager.add({ title: "Second", timeout: 0 });
    await waitForToast("Second");
    expect(toastRoots().length).toBeGreaterThan(1);

    manager.close(extra);
    await waitForToastGone("Second");
    expect(queryToastCopy("Saved")).toBeTruthy();

    manager.close();
    await vi.waitFor(() => {
      expect(toastRoots()).toHaveLength(0);
    });
  });

  it("defaults error to high/alert and other types to low; explicit priority wins", async () => {
    const { manager } = renderToast();

    manager.add({ type: "error", title: "Outage", description: "Grid is down.", timeout: 0 });
    await waitForToast("Outage");
    expect(page.getByRole("alert").element()).toBeTruthy();
    expect(toastRootNamed("Outage").getAttribute("role")).toBe("alertdialog");
    expect(toastRootNamed("Outage").getAttribute("data-status")).toBe("error");
    manager.close();
    await vi.waitFor(() => {
      expect(page.getByRole("alert").query()).toBeNull();
    });

    for (const type of ["info", "success", "warning", "loading"] as const) {
      manager.add({ type, title: type, timeout: 0 });
      const root = await waitForToast(type);
      expect(root.getAttribute("data-status"), type).toBe(type);
      expect(root.getAttribute("role"), type).toBe("dialog");
      expect(page.getByRole("alert").query(), type).toBeNull();
      manager.close();
      await waitForToastGone(type);
    }

    manager.add({ title: "Plain", timeout: 0 });
    const neutral = await waitForToast("Plain");
    expect(neutral.getAttribute("data-status")).toBe("neutral");
    expect(neutral.getAttribute("role")).toBe("dialog");
    expect(neutral.querySelector("[data-toast-icon]")).toBeNull();
    manager.close();
    await waitForToastGone("Plain");

    manager.add({ type: "error", priority: "low", title: "Quiet error", timeout: 0 });
    const quiet = await waitForToast("Quiet error");
    expect(quiet.getAttribute("role")).toBe("dialog");
    expect(page.getByRole("alert").query()).toBeNull();
    manager.close();
    await waitForToastGone("Quiet error");

    manager.add({ type: "success", priority: "high", title: "Loud success", timeout: 0 });
    const loud = await waitForToast("Loud success");
    expect(loud.getAttribute("role")).toBe("alertdialog");
    expect(page.getByRole("alert").element()).toBeTruthy();
  });

  it("promise walks loading → success and loading → error, with state-level priority overrides", async () => {
    const { manager } = renderToast();

    let resolveOk: (value: string) => void = () => {
      throw new Error("unresolved");
    };
    const ok = new Promise<string>((resolve) => {
      resolveOk = resolve;
    });
    const successPromise = manager.promise(ok, {
      loading: "Saving…",
      success: { title: "Saved", description: "Stored." },
      error: "Failed",
    });

    const loading = await waitForToast("Saving…");
    expect(loading.getAttribute("data-status")).toBe("loading");
    expect(loading.getAttribute("role")).toBe("dialog");
    expect(loading.querySelector("[data-toast-icon]")).not.toBeNull();
    expect(page.getByRole("alert").query()).toBeNull();

    resolveOk("done");
    await expect(successPromise).resolves.toBe("done");
    const success = await waitForToast("Saved");
    expect(success.getAttribute("data-status")).toBe("success");
    expect(success.getAttribute("role")).toBe("dialog");
    expect(queryToastCopy("Stored.")).toBeTruthy();
    expect(queryToastCopy("Saving…")).toBeUndefined();
    manager.close();
    await waitForToastGone("Saved");

    let rejectErr: (reason: Error) => void = () => {
      throw new Error("unrejected");
    };
    const failing = new Promise<string>((_resolve, reject) => {
      rejectErr = reject;
    });
    const errorPromise = manager.promise(failing, {
      loading: "Uploading…",
      success: "Uploaded",
      error: { title: "Upload failed", description: "Try again." },
    });
    await waitForToast("Uploading…");
    rejectErr(new Error("nope"));
    await expect(errorPromise).rejects.toThrow("nope");
    const errorRoot = await waitForToast("Upload failed");
    expect(errorRoot.getAttribute("data-status")).toBe("error");
    expect(errorRoot.getAttribute("role")).toBe("alertdialog");
    expect(page.getByRole("alert").element()).toBeTruthy();
    manager.close();
    await waitForToastGone("Upload failed");

    let resolveLoud: (value: string) => void = () => {
      throw new Error("unresolved");
    };
    const loudOk = new Promise<string>((resolve) => {
      resolveLoud = resolve;
    });
    const loudPromise = manager.promise(loudOk, {
      loading: "Working…",
      success: { title: "Loud save", priority: "high" },
      error: { title: "Quiet fail", priority: "low" },
    });
    await waitForToast("Working…");
    resolveLoud("ok");
    await expect(loudPromise).resolves.toBe("ok");
    const loud = await waitForToast("Loud save");
    expect(loud.getAttribute("role")).toBe("alertdialog");
    expect(page.getByRole("alert").element()).toBeTruthy();
    manager.close();
    await waitForToastGone("Loud save");

    let rejectQuiet: (reason: Error) => void = () => {
      throw new Error("unrejected");
    };
    const quietFail = new Promise<string>((_resolve, reject) => {
      rejectQuiet = reject;
    });
    const quietPromise = manager.promise(quietFail, {
      loading: "Working…",
      success: "ok",
      error: { title: "Quiet fail", priority: "low" },
    });
    await waitForToast("Working…");
    rejectQuiet(new Error("nope"));
    await expect(quietPromise).rejects.toThrow("nope");
    const quiet = await waitForToast("Quiet fail");
    expect(quiet.getAttribute("data-status")).toBe("error");
    expect(quiet.getAttribute("role")).toBe("dialog");
    expect(page.getByRole("alert").query()).toBeNull();
  });

  it("promise keeps the type a success state returns", async () => {
    const { manager } = renderToast();

    const warned = manager.promise(Promise.resolve(3), {
      loading: "Recalculating…",
      success: (count) => ({ type: "warning", title: "Recalculated", description: `${count} warnings` }),
      error: "Failed",
    });
    await expect(warned).resolves.toBe(3);
    const warning = await waitForToast("Recalculated");
    expect(warning.getAttribute("data-status")).toBe("warning");
    expect(warning.getAttribute("role")).toBe("dialog");
  });

  it("promise derives priority from the type a success state returns", async () => {
    const { manager } = renderToast();

    const refused = manager.promise(Promise.resolve("refused"), {
      loading: "Submitting…",
      success: { type: "error", title: "Order refused" },
      error: "Failed",
    });
    await expect(refused).resolves.toBe("refused");
    const refusal = await waitForToast("Order refused");
    expect(refusal.getAttribute("data-status")).toBe("error");
    expect(refusal.getAttribute("role")).toBe("alertdialog");
    expect(page.getByRole("alert").element()).toBeTruthy();
  });

  it("promise without loading shows nothing until the promise settles", async () => {
    const { manager } = renderToast();

    let resolveOk: (value: string) => void = () => {
      throw new Error("unresolved");
    };
    const ok = new Promise<string>((resolve) => {
      resolveOk = resolve;
    });
    const settled = manager.promise(ok, { success: "Synced", error: "Sync failed" });
    // A toast added after promise() renders in the same pass as any toast promise() added.
    manager.add({ title: "Sentinel" });
    const sentinel = await waitForToast("Sentinel");
    expect(toastRoots()).toEqual([sentinel]);

    resolveOk("done");
    await expect(settled).resolves.toBe("done");
    const success = await waitForToast("Synced");
    expect(success.getAttribute("data-status")).toBe("success");
  });

  it("promise moves to the error state when the success factory throws", async () => {
    const { manager } = renderToast();

    const broken = manager.promise(Promise.resolve("value"), {
      loading: "Loading…",
      success: () => {
        throw new Error("render failed");
      },
      error: (cause) => ({ title: "Could not show the result", description: cause.message }),
    });
    await expect(broken).rejects.toThrow("render failed");
    const errorRoot = await waitForToast("Could not show the result");
    expect(errorRoot.getAttribute("data-status")).toBe("error");
    expect(queryToastCopy("render failed")).toBeTruthy();
    expect(queryToastCopy("Loading…")).toBeUndefined();
  });
});

describe("Toast chrome", () => {
  it("renders actionProps as a button and Close dismisses under en-US", async () => {
    const onAction = vi.fn();
    const { manager } = renderToast();
    manager.add({
      title: "Item deleted",
      timeout: 0,
      actionProps: { children: "Undo", onClick: onAction },
    });
    await waitForToast("Item deleted");
    await expandViewport();

    const action = page.getByRole("button", { name: "Undo", exact: true }).element();
    await userEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);

    const close = page.getByRole("button", { name: "Close", exact: true }).element();
    await userEvent.click(close);
    await waitForToastGone("Item deleted");
  });

  it("renders Close copy in all four locales, lets label override it, and lets an explicit aria-label win over both", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const manager = Toast.createToastManager();
      const { unmount } = renderToast(<Toast.Viewport />, { locale, manager });
      manager.add({ title: "Notice", timeout: 0 });
      await waitForToast("Notice");
      await expandViewport();
      expect(page.getByRole("button", { name: CLOSE_COPY[locale], exact: true }).query()).not.toBeNull();
      unmount();
    }

    const labelled = renderToast(<LabelledClose close={<Toast.Close label="Dismiss toast" />} />);
    labelled.manager.add({ title: "Override", timeout: 0 });
    await waitForToast("Override");
    await expandViewport();
    expect(page.getByRole("button", { name: "Dismiss toast", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Close", exact: true }).query()).toBeNull();
    labelled.unmount();

    const iconOnly = renderToast(<LabelledClose close={<Toast.Close aria-label="Dismiss" />} />);
    iconOnly.manager.add({ title: "Labelled", timeout: 0 });
    await waitForToast("Labelled");
    await expandViewport();
    expect(roleNamed("button", "Dismiss").textContent).toBe("");
    expect(page.getByRole("button", { name: "Close", exact: true }).query()).toBeNull();
    iconOnly.unmount();

    const overLabel = renderToast(
      <LabelledClose close={<Toast.Close label="Dismiss toast" aria-label="Dismiss" />} />
    );
    overLabel.manager.add({ title: "Over label", timeout: 0 });
    await waitForToast("Over label");
    await expandViewport();
    expect(roleNamed("button", "Dismiss").textContent).toBe("");
    expect(page.getByRole("button", { name: "Dismiss toast", exact: true }).query()).toBeNull();
    overLabel.unmount();

    const visible = renderToast(
      <LabelledClose close={<Toast.Close aria-label="Dismiss">Close</Toast.Close>} />
    );
    visible.manager.add({ title: "Visible", timeout: 0 });
    await waitForToast("Visible");
    await expandViewport();
    expect(roleNamed("button", "Dismiss").textContent).toBe("Close");
  });

  it("F6 moves focus into the viewport and Escape restores the prior element", async () => {
    const { manager } = renderToast(
      <>
        <button type="button">Focus start</button>
        <Toast.Viewport />
      </>
    );
    manager.add({ title: "Keyboard toast", timeout: 0 });
    await waitForToast("Keyboard toast");

    const start = page.getByRole("button", { name: "Focus start", exact: true }).element();
    start.focus();
    expect(document.activeElement).toBe(start);

    await userEvent.keyboard("{F6}");
    await expect.element(page.getByRole("region", { name: "Notifications", exact: true })).toHaveFocus();

    await userEvent.keyboard("{Tab}");
    const root = toastRootNamed("Keyboard toast");
    await vi.waitFor(() => {
      expect(root.contains(document.activeElement)).toBe(true);
    });

    await userEvent.keyboard("{Escape}");
    await waitForToastGone("Keyboard toast");
    await expect.element(page.getByRole("button", { name: "Focus start", exact: true })).toHaveFocus();
  });
});

describe("Toast contrast", () => {
  let restoreDocumentTheme: () => void;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
  });

  afterEach(() => {
    restoreDocumentTheme();
  });

  it.each(["error", "info", "success", "warning"] as const)(
    "paints the %s title and description with the paired soft foreground in internal dark",
    async (status) => {
      stampDocumentTheme(fkasPrivate, "dark");

      const { manager } = renderToast();
      manager.add({ type: status, title: "Outage", description: "Grid is down.", timeout: 0 });
      const root = await waitForToast("Outage");
      const title = toastCopy("Outage");
      const description = toastCopy("Grid is down.");

      const softProbe = document.createElement("span");
      softProbe.style.color = `var(--${status}-soft-foreground)`;
      const statusProbe = document.createElement("span");
      statusProbe.style.color = `var(--${status})`;
      root.append(softProbe, statusProbe);
      const softColor = getComputedStyle(softProbe).color;
      const statusColor = getComputedStyle(statusProbe).color;
      softProbe.remove();
      statusProbe.remove();

      expect(softColor, "the soft pair must differ from the raw status role").not.toBe(statusColor);
      expect(getComputedStyle(title).color).toBe(softColor);
      expect(getComputedStyle(description).color).toBe(softColor);
    }
  );

  it.each(["neutral", "loading"] as const)(
    "keeps the %s description on the muted-foreground fallback in internal dark",
    async (status) => {
      stampDocumentTheme(fkasPrivate, "dark");

      const { manager } = renderToast();
      manager.add(
        status === "loading"
          ? { type: "loading", title: "Notice", description: "Nothing to report.", timeout: 0 }
          : { title: "Notice", description: "Nothing to report.", timeout: 0 }
      );
      const root = await waitForToast("Notice");
      const description = toastCopy("Nothing to report.");

      expect(getComputedStyle(description).color).toBe(cssVarColor(root, "--muted-foreground"));
    }
  );
});

describe("Toast motion", () => {
  it("transitions transform and opacity only, at or under 300 ms", async () => {
    const { manager } = renderToast();
    manager.add({ title: "Saved", timeout: 0 });
    const root = await waitForToast("Saved");
    const style = getComputedStyle(root);
    const properties = style.transitionProperty.split(",").map((part) => part.trim());
    expect(properties).not.toContain("height");
    expect(properties).toEqual(expect.arrayContaining(["transform", "opacity"]));
    for (const duration of style.transitionDuration.split(",")) {
      const trimmed = duration.trim();
      const ms = trimmed.endsWith("ms") ? Number.parseFloat(trimmed) : Number.parseFloat(trimmed) * 1000;
      expect(ms).toBeGreaterThanOrEqual(150);
      expect(ms).toBeLessThanOrEqual(300);
    }
  });
});

describe("Toast overlay containment", () => {
  it("portals the viewport into an explicit container element", async () => {
    const manager = Toast.createToastManager();

    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? (
            <Toast.Provider toastManager={manager} timeout={0}>
              <Toast.Viewport container={node} />
            </Toast.Provider>
          ) : null}
        </>
      );
    }

    renderThemed(withLocale("en-US", <ExplicitContainer />));
    manager.add({ title: "Islanded", timeout: 0 });
    const root = await waitForToast("Islanded");
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(root)).toBe(true);
    expect([...document.body.children].includes(root)).toBe(false);
  });
});

describe("Toast layer", () => {
  // A toast raised from inside an open modal must paint over it. The modal's portal mounts
  // after the viewport's, so a shared z-index would let the modal win on DOM order.
  for (const [family, modal] of [
    [
      "Sheet",
      <Sheet.Root key="sheet">
        <Sheet.Trigger>Open modal</Sheet.Trigger>
        <Sheet.Content>
          <Sheet.Title>Order details</Sheet.Title>
        </Sheet.Content>
      </Sheet.Root>,
    ],
    [
      "Dialog",
      <Dialog.Root key="dialog">
        <Dialog.Trigger>Open modal</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Order details</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>,
    ],
  ] as const) {
    it(`paints a toast above an open ${family}`, async () => {
      const { manager } = renderToast(
        <>
          <Toast.Viewport />
          {modal}
        </>
      );
      await userEvent.click(page.getByRole("button", { name: "Open modal", exact: true }));
      await vi.waitFor(() => {
        expect(page.getByRole("dialog", { name: "Order details", exact: true }).query()).toBeTruthy();
      });

      manager.add({ title: "Copied to clipboard", timeout: 0 });
      const root = await waitForToast("Copied to clipboard");
      await vi.waitFor(() => {
        // DOM audit: paint order has no accessible role. The covering backdrop or popup
        // panel has none either, so the failure message names it by its data-slot.
        const box = root.getBoundingClientRect();
        const topmost = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const covering = topmost?.closest("[data-slot]")?.getAttribute("data-slot");
        expect(topmost !== null && root.contains(topmost), `covered by ${covering}`).toBe(true);
      });
    });
  }
});
