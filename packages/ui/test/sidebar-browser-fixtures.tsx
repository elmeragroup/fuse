import type { ComponentProps, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { afterEach, beforeEach, vi } from "vitest";
import { cdp, page } from "vitest/browser";

import { Sidebar, useSidebar } from "../src/components/sidebar/sidebar";
import type {
  SidebarContextValue,
  SidebarProviderProps,
  SidebarRootProps,
} from "../src/components/sidebar/sidebar";
import type { SupportedLocale } from "../src/theme/elmera-group-ui";
import { withLocale } from "./locale-matrix";
import { TOGGLE_COPY } from "./sidebar-contract";

export const DESKTOP = { width: 1024, height: 768 } as const;
export const MOBILE = { width: 500, height: 800 } as const;

type ReducedMotionCdp = {
  send: (
    method: "Emulation.setEmulatedMedia",
    params: { features: { name: "prefers-reduced-motion"; value: "reduce" | "no-preference" }[] }
  ) => Promise<void>;
};

export async function emulateReducedMotion(value: "reduce" | "no-preference"): Promise<void> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session: ReducedMotionCdp = cdp() as ReducedMotionCdp;
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });
}

/**
 * The reset every sidebar browser suite runs: desktop viewport in, and on the way out the
 * persisted `sidebar:state` cookie cleared, the viewport restored and reduced motion released.
 */
export function setupSidebarBrowser(): void {
  beforeEach(async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
  });

  afterEach(async () => {
    document.cookie = "sidebar:state=; path=/; max-age=0";
    await page.viewport(DESKTOP.width, DESKTOP.height);
    await emulateReducedMotion("no-preference");
  });
}

/** DOM audit: every part stamps its slot; no data-sidebar anywhere. */
export function bySlot(slot: string, root: ParentNode = document): HTMLElement {
  const node = root.querySelector(`[data-slot="${slot}"]`);
  if (!(node instanceof HTMLElement)) {
    throw new Error(`expected [data-slot="${slot}"]`);
  }
  return node;
}

export function sidebarRoot(): HTMLElement {
  const dialog = page.getByRole("dialog").query();
  if (dialog instanceof HTMLElement) {
    return dialog;
  }
  for (const title of Object.values(TOGGLE_COPY)) {
    const rail = page.getByTitle(title, { exact: true }).query();
    if (rail instanceof HTMLElement) {
      const root = rail.closest("[data-state]");
      if (root instanceof HTMLElement) {
        return root;
      }
    }
  }
  throw new Error("expected sidebar root");
}

export function layoutChildren(root: HTMLElement): HTMLElement[] {
  return [...root.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
}

export function menuList(): HTMLElement {
  const node = page.getByRole("list").element();
  if (!(node instanceof HTMLElement)) {
    throw new Error("expected a menu list");
  }
  return node;
}

/** Trigger is the only tab-stop named from sidebar.toggle; Rail is aria-hidden. */
export function railNamed(name: string): HTMLButtonElement {
  const rail = page.getByTitle(name, { exact: true }).element();
  if (!(rail instanceof HTMLButtonElement)) {
    throw new Error(`expected a sidebar rail titled ${name}`);
  }
  return rail;
}

export function Frame({
  provider,
  root,
  rail = <Sidebar.Rail />,
  children,
  probe,
  locale = "en-US",
}: {
  provider?: Partial<SidebarProviderProps>;
  root?: Partial<SidebarRootProps>;
  /** Replaces the default `<Sidebar.Rail />`; pass a fragment or wrapper to vary its position. */
  rail?: ReactNode;
  children?: ReactNode;
  /** Rendered in the Inset, so it survives the mobile branch (Root's children live inside the closed Sheet). */
  probe?: ReactNode;
  locale?: SupportedLocale;
}) {
  return withLocale(
    locale,
    <Sidebar.Provider {...provider}>
      <Sidebar.Root {...root}>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>{children}</Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
        {rail}
      </Sidebar.Root>
      <Sidebar.Inset>
        <Sidebar.Trigger />
        <button type="button">After</button>
        {probe}
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}

/**
 * The menu link most sidebar suites need: a `MenuButton` rendered as an anchor named Orders,
 * inside its `MenuItem`. `href` and the remaining MenuButton props pass through.
 */
export function OrdersLink({
  href = "/orders",
  ...props
}: Omit<ComponentProps<typeof Sidebar.MenuButton>, "render" | "children"> & { href?: string }) {
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton {...props} render={<a href={href} />}>
        Orders
      </Sidebar.MenuButton>
    </Sidebar.MenuItem>
  );
}

export function ContextProbe({ onValue }: { onValue: (value: SidebarContextValue) => void }) {
  const context = useSidebar();
  const latest = useRef(onValue);
  useLayoutEffect(() => {
    latest.current = onValue;
  });
  useEffect(() => {
    latest.current(context);
  }, [context]);
  return null;
}

/** Records every `document.cookie` write while `run` executes; the real setter still runs. */
export async function captureCookieWrites(run: () => Promise<void>): Promise<string[]> {
  const setter = vi.spyOn(document, "cookie", "set");
  try {
    await run();
    return setter.mock.calls.map(([value]) => value);
  } finally {
    setter.mockRestore();
  }
}
