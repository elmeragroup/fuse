import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; styles.css defines none of them.
import "../../../dist/themes.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Dialog } from "../dialog/index";
import { Sheet } from "../sheet/index";
import { Toast } from "./index";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

const NOTIFICATIONS_COPY = {
  "nb-NO": "Varsler",
  "sv-SE": "Aviseringar",
  "en-US": "Notifications",
  "fi-FI": "Ilmoitukset",
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

/** Waits for a toast to start its exit, which is when a close or swipe has dismissed it. */
async function waitForEnding(root: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(root.hasAttribute("data-ending-style")).toBe(true);
  });
}

/** Moves focus into the viewport region, named by the render's locale (English by default). */
async function expandViewport(name: string = NOTIFICATIONS_COPY["en-US"]): Promise<HTMLElement> {
  const viewport = page.getByRole("region", { name, exact: true }).element();
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
  it("add returns an id, upserts by id, and close ends one or all", async () => {
    const { manager } = renderToast();

    const first = manager.add({ id: "save", title: "Saving…", description: "Please wait.", timeout: 0 });
    expect(first).toBe("save");
    await waitForToast("Saving…");
    expect(queryToastCopy("Please wait.")).toBeTruthy();

    const upserted = manager.add({ id: "save", title: "Saved", description: "Changes stored.", timeout: 0 });
    expect(upserted).toBe("save");
    const saved = await waitForToast("Saved");
    expect(queryToastCopy("Saving…")).toBeUndefined();
    expect(toastRoots()).toHaveLength(1);

    const extra = manager.add({ title: "Second", timeout: 0 });
    const second = await waitForToast("Second");

    manager.close(extra);
    await waitForEnding(second);
    expect(saved.hasAttribute("data-ending-style")).toBe(false);

    manager.close();
    await waitForEnding(saved);
  });

  it("defaults error to high/alert and other types to low; explicit priority wins", async () => {
    const { manager } = renderToast(<Toast.Viewport />, { limit: 10 });
    const cases = [
      {
        options: { type: "error", title: "Outage", description: "Grid is down." },
        status: "error",
        high: true,
      },
      { options: { type: "info", title: "Info note" }, status: "info", high: false },
      { options: { type: "success", title: "Done note" }, status: "success", high: false },
      { options: { type: "warning", title: "Careful note" }, status: "warning", high: false },
      { options: { type: "loading", title: "Busy note" }, status: "loading", high: false },
      { options: { title: "Plain" }, status: "neutral", high: false },
      { options: { type: "error", priority: "low", title: "Quiet error" }, status: "error", high: false },
      {
        options: { type: "success", priority: "high", title: "Loud success" },
        status: "success",
        high: true,
      },
    ] as const;
    for (const { options } of cases) {
      manager.add({ ...options, timeout: 0 });
    }

    for (const { options, status, high } of cases) {
      const root = await waitForToast(options.title);
      expect(root.getAttribute("data-status"), options.title).toBe(status);
      expect(root.getAttribute("role"), options.title).toBe(high ? "alertdialog" : "dialog");
    }
    expect(toastRootNamed("Plain").querySelector("[data-toast-icon]")).toBeNull();
    // The visually hidden live region announces exactly the high-priority toasts.
    const announced = page
      .getByRole("alert")
      .elements()
      .map((alert) => alert.textContent)
      .join("|");
    for (const { options, high } of cases) {
      expect(announced.includes(options.title), options.title).toBe(high);
    }
  });

  it("promise walks loading → settled state, with returned types and state-level priority overrides", async () => {
    const { manager } = renderToast(<Toast.Viewport />, { limit: 10 });

    const ok = Promise.withResolvers<string>();
    const failing = Promise.withResolvers<string>();
    const loudOk = Promise.withResolvers<string>();
    const quietFail = Promise.withResolvers<string>();
    const successPromise = manager.promise(ok.promise, {
      loading: "Saving…",
      success: { title: "Saved", description: "Stored." },
      error: "Failed",
    });
    const errorPromise = manager.promise(failing.promise, {
      loading: "Uploading…",
      success: "Uploaded",
      error: { title: "Upload failed", description: "Try again." },
    });
    const loudPromise = manager.promise(loudOk.promise, {
      loading: "Working…",
      success: { title: "Loud save", priority: "high" },
      error: { title: "Quiet fail", priority: "low" },
    });
    const quietPromise = manager.promise(quietFail.promise, {
      loading: "Retrying…",
      success: "ok",
      error: { title: "Quiet fail", priority: "low" },
    });

    const loading = await waitForToast("Saving…");
    expect(loading.getAttribute("data-status")).toBe("loading");
    expect(loading.getAttribute("role")).toBe("dialog");
    expect(loading.querySelector("[data-toast-icon]")).not.toBeNull();
    await waitForToast("Uploading…");
    await waitForToast("Working…");
    await waitForToast("Retrying…");
    expect(page.getByRole("alert").query()).toBeNull();

    ok.resolve("done");
    failing.reject(new Error("nope"));
    loudOk.resolve("ok");
    quietFail.reject(new Error("quiet nope"));
    await expect(successPromise).resolves.toBe("done");
    await expect(errorPromise).rejects.toThrow("nope");
    await expect(loudPromise).resolves.toBe("ok");
    await expect(quietPromise).rejects.toThrow("quiet nope");

    const success = await waitForToast("Saved");
    expect(success.getAttribute("data-status")).toBe("success");
    expect(success.getAttribute("role")).toBe("dialog");
    expect(queryToastCopy("Stored.")).toBeTruthy();
    expect(queryToastCopy("Saving…")).toBeUndefined();

    const errorRoot = await waitForToast("Upload failed");
    expect(errorRoot.getAttribute("data-status")).toBe("error");
    expect(errorRoot.getAttribute("role")).toBe("alertdialog");

    const loud = await waitForToast("Loud save");
    expect(loud.getAttribute("data-status")).toBe("success");
    expect(loud.getAttribute("role")).toBe("alertdialog");

    const quiet = await waitForToast("Quiet fail");
    expect(quiet.getAttribute("data-status")).toBe("error");
    expect(quiet.getAttribute("role")).toBe("dialog");

    // A returned `type` replaces the settled default, and priority derives from it.
    const warned = manager.promise(Promise.resolve(3), {
      loading: "Recalculating…",
      success: (count) => ({ type: "warning", title: "Recalculated", description: `${count} warnings` }),
      error: "Failed",
    });
    const refused = manager.promise(Promise.resolve("refused"), {
      loading: "Submitting…",
      success: { type: "error", title: "Order refused" },
      error: "Failed",
    });
    await expect(warned).resolves.toBe(3);
    await expect(refused).resolves.toBe("refused");
    const warning = await waitForToast("Recalculated");
    expect(warning.getAttribute("data-status")).toBe("warning");
    expect(warning.getAttribute("role")).toBe("dialog");
    const refusal = await waitForToast("Order refused");
    expect(refusal.getAttribute("data-status")).toBe("error");
    expect(refusal.getAttribute("role")).toBe("alertdialog");
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

  it("useToastManager keeps add, update, close and promise stable while toasts change", async () => {
    const renders: Array<{ toasts: number; methods: readonly unknown[] }> = [];
    function Recorder() {
      const { toasts, add, update, close, promise } = Toast.useToastManager();
      renders.push({ toasts: toasts.length, methods: [add, update, close, promise] });
      return <Toast.Viewport />;
    }
    const { manager } = renderToast(<Recorder />);

    manager.add({ title: "Stable", timeout: 0 });
    await waitForToast("Stable");
    manager.add({ title: "Stable too", timeout: 0 });
    await waitForToast("Stable too");

    expect(renders.map((render) => render.toasts)).toEqual(expect.arrayContaining([0, 1, 2]));
    const [first] = renders;
    for (const render of renders) {
      render.methods.forEach((method, index) => {
        expect(method).toBe(first?.methods[index]);
      });
    }
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
    const root = await waitForToast("Item deleted");
    await expandViewport();

    const action = page.getByRole("button", { name: "Undo", exact: true }).element();
    await userEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);

    const close = page.getByRole("button", { name: "Close", exact: true }).element();
    await userEvent.click(close);
    await waitForEnding(root);
  });

  it("names the viewport region in all four locales, keeps it under an unset aria-label, and lets an explicit aria-label win", () => {
    for (const locale of SUPPORTED_LOCALES) {
      // A wrapper that forwards an unset aria-label must not erase the localized name.
      const { unmount } = renderToast(<Toast.Viewport aria-label={undefined} />, { locale });
      expect(roleNamed("region", NOTIFICATIONS_COPY[locale]).getAttribute("data-slot"), locale).toBe(
        "toast-viewport"
      );
      unmount();
    }
    renderToast(<Toast.Viewport aria-label="Ordrevarsler" />, { locale: "nb-NO" });
    expect(roleNamed("region", "Ordrevarsler").getAttribute("data-slot")).toBe("toast-viewport");
  });

  it("renders Close copy in all four locales, lets label override it, and lets an explicit aria-label win over both", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const manager = Toast.createToastManager();
      const { unmount } = renderToast(<Toast.Viewport />, { locale, manager });
      manager.add({ title: "Notice", timeout: 0 });
      await waitForToast("Notice");
      await expandViewport(NOTIFICATIONS_COPY[locale]);
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
        // Paint order has no accessible role. The covering backdrop or popup
        // panel has none either, so the failure message names it by its data-slot.
        const box = root.getBoundingClientRect();
        const topmost = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const covering = topmost?.closest("[data-slot]")?.getAttribute("data-slot");
        expect(topmost !== null && root.contains(topmost), `covered by ${covering}`).toBe(true);
      });
    });
  }
});
