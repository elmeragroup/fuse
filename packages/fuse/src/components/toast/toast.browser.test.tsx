import { useState } from "react";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; styles.css defines none of them.
import "../../../dist/themes.css";
import { ringLayers, settleTransitions } from "../../../test/assert-invalid-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  computedContrast,
  cssVarColor,
  fkasPrivate,
  renderThemed,
  roleNamed,
  snapshotDocumentTheme,
  stampDocumentTheme,
  stampTheme,
} from "../../../test/themed-browser-render";
import { LEGAL_THEMES, themeSlug } from "../../theme/tokens/themes";
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

function deferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error("unresolved");
  };
  let reject: (reason: Error) => void = () => {
    throw new Error("unrejected");
  };
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
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

    const ok = deferred<string>();
    const failing = deferred<string>();
    const loudOk = deferred<string>();
    const quietFail = deferred<string>();
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

  it("promise without loading shows nothing until the promise settles", async () => {
    const { manager } = renderToast();

    const ok = deferred<string>();
    const settled = manager.promise(ok.promise, { success: "Synced", error: "Sync failed" });
    // A toast added after promise() renders in the same pass as any toast promise() added.
    manager.add({ title: "Sentinel" });
    const sentinel = await waitForToast("Sentinel");
    expect(toastRoots()).toEqual([sentinel]);

    ok.resolve("done");
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

  it.each(["error", "info", "success", "warning"] as const)(
    "draws the %s close button's focus ring at 3:1 against the toast fill in every theme and scheme",
    async (status) => {
      const { manager } = renderToast();
      manager.add({ type: status, title: "Outage", timeout: 0 });
      const root = await waitForToast("Outage");
      await expandViewport();
      const close = roleNamed("button", "Close");
      // A real Tab, so the button matches `:focus-visible` and paints the ring.
      for (let step = 0; step < 4 && document.activeElement !== close; step += 1) {
        await userEvent.keyboard("{Tab}");
      }
      expect(document.activeElement).toBe(close);
      // The toast portals into renderThemed's ThemeScope, whose own stamp outranks the
      // document's, so the theme goes on that scope and the scheme on the document.
      const scope = root.closest<HTMLElement>("[data-theme-brand]");
      if (scope === null || scope === document.documentElement) {
        throw new Error("expected the toast inside renderThemed's ThemeScope");
      }

      for (const scheme of ["light", "dark"] as const) {
        for (const theme of LEGAL_THEMES) {
          stampDocumentTheme(theme, scheme);
          stampTheme(scope, theme);
          settleTransitions(root, close);
          const [ring] = ringLayers(close);
          const context = `${themeSlug(theme)} ${scheme} ${status}`;
          expect(ring, context).toBeDefined();
          // WCAG 1.4.11: the flush ring is the indicator's only edge against the fill.
          expect
            .soft(computedContrast(ring?.color ?? "", getComputedStyle(root).backgroundColor), context)
            .toBeGreaterThanOrEqual(3);
        }
      }
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

describe("Toast placement", () => {
  // From `sm` (40rem) up the stack is a 340px column 32px in from its edges; below `sm`
  // it sits at the bottom and spans the screen minus a 16px gutter on each side.
  const SM_COLUMN_PX = 340;
  const DESKTOP_GUTTER_PX = 32;
  const MOBILE_GUTTER_PX = 16;
  // Root recipe constants: a collapsed toast peeks 0.75rem past the one in front of it, and
  // an expanded stack leaves a 0.75rem gap between toasts.
  const PEEK_PX = 12;
  const GAP_PX = 12;

  const PLACEMENTS = [
    { placement: "top-left", vertical: "top", horizontal: "left" },
    { placement: "top-center", vertical: "top", horizontal: "center" },
    { placement: "top-right", vertical: "top", horizontal: "right" },
    { placement: "bottom-left", vertical: "bottom", horizontal: "left" },
    { placement: "bottom-center", vertical: "bottom", horizontal: "center" },
    { placement: "bottom-right", vertical: "bottom", horizontal: "right" },
  ] as const;

  function currentSize() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  let restoreSize = currentSize();

  beforeEach(() => {
    restoreSize = currentSize();
  });

  afterEach(async () => {
    await page.viewport(restoreSize.width, restoreSize.height);
  });

  /** Distances from the toast's box to each edge of the screen. */
  function gaps(element: HTMLElement) {
    const box = element.getBoundingClientRect();
    return {
      width: box.width,
      top: box.top,
      bottom: window.innerHeight - box.bottom,
      left: box.left,
      right: document.documentElement.clientWidth - box.right,
    };
  }

  function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  /**
   * Drags a mouse pointer across `element` by (`dx`, `dy`) in small steps and releases it.
   * Base UI's swipe handlers read pointer events from the root and the document, so
   * dispatched events walk the same path a real drag does. Each root tracks its own active
   * pointer, so drags on different roots can run at once.
   */
  async function swipe(element: HTMLElement, dx: number, dy: number): Promise<void> {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const pointer = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true };
    element.dispatchEvent(
      new PointerEvent("pointerdown", { ...pointer, button: 0, buttons: 1, clientX: x, clientY: y })
    );
    await nextFrame();
    const steps = 6;
    for (let step = 1; step <= steps; step += 1) {
      element.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          buttons: 1,
          clientX: x + (dx * step) / steps,
          clientY: y + (dy * step) / steps,
          movementX: dx / steps,
          movementY: dy / steps,
        })
      );
      await nextFrame();
    }
    element.dispatchEvent(
      new PointerEvent("pointerup", { ...pointer, button: 0, clientX: x + dx, clientY: y + dy })
    );
    await nextFrame();
  }

  async function expectToastsStay(...names: string[]): Promise<void> {
    // A dismissal is decided on pointerup; a few frames later the toast would be ending.
    for (let frame = 0; frame < 10; frame += 1) {
      await nextFrame();
    }
    for (const name of names) {
      expect(toastRootNamed(name).hasAttribute("data-ending-style"), name).toBe(false);
    }
  }

  /**
   * Renders each viewport under its own provider and raises one toast in it, titled by its key,
   * so several placements share one render and their enter transitions run at once.
   */
  async function renderViewports(viewports: Record<string, ReactNode>): Promise<Record<string, HTMLElement>> {
    const entries = Object.entries(viewports).map(([name, viewport]) => ({
      name,
      viewport,
      manager: Toast.createToastManager(),
    }));
    renderThemed(
      withLocale(
        "en-US",
        <>
          {entries.map(({ name, viewport, manager }) => (
            <Toast.Provider key={name} toastManager={manager} timeout={0}>
              {viewport}
            </Toast.Provider>
          ))}
        </>
      )
    );
    const roots: Record<string, HTMLElement> = {};
    for (const { name, manager } of entries) {
      manager.add({ title: name, timeout: 0 });
      roots[name] = await waitForToast(name);
    }
    return roots;
  }

  it("puts the stack at each placement's edge and alignment from sm up, and every placement at the bottom, spanning the screen minus its gutters, below sm", async () => {
    await page.viewport(1024, 768);
    const roots = await renderViewports(
      Object.fromEntries(
        PLACEMENTS.map(({ placement }) => [
          placement,
          <Toast.Viewport key={placement} placement={placement} />,
        ])
      )
    );
    await vi.waitFor(() => {
      for (const { placement, vertical, horizontal } of PLACEMENTS) {
        const box = gaps(roots[placement] ?? document.body);
        expect(box.width, placement).toBeCloseTo(SM_COLUMN_PX, 0);
        expect(box[vertical], placement).toBeCloseTo(DESKTOP_GUTTER_PX, 0);
        if (horizontal === "center") {
          expect(box.left, placement).toBeCloseTo(box.right, 0);
        } else {
          expect(box[horizontal], placement).toBeCloseTo(DESKTOP_GUTTER_PX, 0);
        }
      }
    });

    await page.viewport(400, 768);
    await vi.waitFor(() => {
      for (const { placement } of PLACEMENTS) {
        const box = gaps(roots[placement] ?? document.body);
        expect(box.bottom, placement).toBeCloseTo(MOBILE_GUTTER_PX, 0);
        expect(box.left, placement).toBeCloseTo(MOBILE_GUTTER_PX, 0);
        expect(box.right, placement).toBeCloseTo(MOBILE_GUTTER_PX, 0);
      }
    });
  });

  it("stacks away from the anchored edge: downward for top placements, upward for bottom", async () => {
    await page.viewport(1024, 768);
    for (const { placement, vertical } of [PLACEMENTS[2], PLACEMENTS[5]]) {
      const { manager, unmount } = renderToast(<Toast.Viewport placement={placement} />);
      manager.add({ title: "Older", timeout: 0 });
      await waitForToast("Older");
      manager.add({ title: "Newer", timeout: 0 });
      const newer = await waitForToast("Newer");
      const older = toastRootNamed("Older");

      // Collapsed, the newest toast holds the anchored edge and the older one peeks out
      // past its far side.
      await vi.waitFor(() => {
        expect(gaps(newer)[vertical]).toBeCloseTo(DESKTOP_GUTTER_PX, 0);
        const newerBox = newer.getBoundingClientRect();
        const olderBox = older.getBoundingClientRect();
        const peek = vertical === "top" ? olderBox.bottom - newerBox.bottom : newerBox.top - olderBox.top;
        expect(peek).toBeCloseTo(PEEK_PX, 0);
      });

      // Expanded, the older toast sits a gap beyond the newest one on the same side.
      await expandViewport();
      await vi.waitFor(() => {
        expect(gaps(newer)[vertical]).toBeCloseTo(DESKTOP_GUTTER_PX, 0);
        const newerBox = newer.getBoundingClientRect();
        const olderBox = older.getBoundingClientRect();
        const gap = vertical === "top" ? olderBox.top - newerBox.bottom : newerBox.top - olderBox.bottom;
        expect(gap).toBeCloseTo(GAP_PX, 0);
      });
      await userEvent.keyboard("{Escape}");
      unmount();
    }
  });

  it("slides a top placement's toast in from above and a bottom placement's from below", async () => {
    await page.viewport(1024, 768);
    // A long transition holds the toast near its starting transform while it is measured.
    function SlowToasts() {
      const { toasts } = Toast.useToastManager();
      return toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast} style={{ transitionDuration: "60s" }}>
          <Toast.Title />
        </Toast.Root>
      ));
    }
    for (const { placement, vertical } of [PLACEMENTS[2], PLACEMENTS[5]]) {
      const { manager, unmount } = renderToast(
        <Toast.Viewport placement={placement}>
          <SlowToasts />
        </Toast.Viewport>
      );
      manager.add({ title: placement, timeout: 0 });
      const box = (await waitForToast(placement)).getBoundingClientRect();
      // Its resting box would start 32px in from the edge; entering, it is still wholly
      // beyond that line, on the edge's side.
      if (vertical === "top") {
        expect(box.bottom).toBeLessThanOrEqual(DESKTOP_GUTTER_PX);
      } else {
        expect(box.top).toBeGreaterThanOrEqual(window.innerHeight - DESKTOP_GUTTER_PX);
      }
      unmount();
    }
  });

  it("dismisses toward the anchored edge and side from sm up, honors an explicit swipeDirection, and places roots passed through the render element", async () => {
    await page.viewport(1024, 768);
    function RightOnlyToasts() {
      const { toasts } = Toast.useToastManager();
      return toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast} swipeDirection="right">
          <Toast.Title />
        </Toast.Root>
      ));
    }
    function RenderedToasts() {
      const { toasts } = Toast.useToastManager();
      return toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast}>
          <Toast.Title />
        </Toast.Root>
      ));
    }
    const roots = await renderViewports({
      "Bottom left": <Toast.Viewport placement="bottom-left" />,
      "Top center": <Toast.Viewport placement="top-center" />,
      Overridden: (
        <Toast.Viewport placement="bottom-left">
          <RightOnlyToasts />
        </Toast.Viewport>
      ),
      // The placement provider wraps the part, so roots in a render element still read it.
      Rendered: (
        <Toast.Viewport
          placement="top-left"
          render={
            <div>
              <RenderedToasts />
            </div>
          }
        />
      ),
    });
    const {
      "Bottom left": bottomLeft,
      "Top center": topCenter,
      Overridden: overridden,
      Rendered: rendered,
    } = roots;
    if (!bottomLeft || !topCenter || !overridden || !rendered) {
      throw new Error("expected every toast");
    }
    await vi.waitFor(() => {
      const box = gaps(rendered);
      expect(box.top).toBeCloseTo(DESKTOP_GUTTER_PX, 0);
      expect(box.left).toBeCloseTo(DESKTOP_GUTTER_PX, 0);
    });

    await Promise.all([swipe(bottomLeft, 120, 0), swipe(topCenter, 0, 120), swipe(overridden, -120, 0)]);
    await expectToastsStay("Bottom left", "Top center", "Overridden");

    await Promise.all([swipe(bottomLeft, -120, 0), swipe(topCenter, 0, -120), swipe(overridden, 120, 0)]);
    await Promise.all([waitForEnding(bottomLeft), waitForEnding(topCenter), waitForEnding(overridden)]);
  });

  it("keeps the default down/right swipe for every placement below sm", async () => {
    await page.viewport(400, 768);
    const roots = await renderViewports({
      "top-left": <Toast.Viewport placement="top-left" />,
      "bottom-left": <Toast.Viewport placement="bottom-left" />,
      "top-center": <Toast.Viewport placement="top-center" />,
    });
    const { "top-left": topLeft, "bottom-left": bottomLeft, "top-center": topCenter } = roots;
    if (!topLeft || !bottomLeft || !topCenter) {
      throw new Error("expected every toast");
    }

    await Promise.all([swipe(topLeft, -120, 0), swipe(bottomLeft, -120, 0), swipe(topCenter, 0, -120)]);
    await expectToastsStay("top-left", "bottom-left", "top-center");

    await Promise.all([swipe(topLeft, 120, 0), swipe(bottomLeft, 120, 0), swipe(topCenter, 0, 120)]);
    await Promise.all([waitForEnding(topLeft), waitForEnding(bottomLeft), waitForEnding(topCenter)]);
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
