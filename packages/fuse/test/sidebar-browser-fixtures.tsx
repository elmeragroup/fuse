import type { ComponentProps, ReactNode } from "react";
import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";

import { afterEach, beforeEach, vi } from "vitest";
import { page } from "vitest/browser";

import { Avatar } from "../src/components/avatar";
import { Sidebar } from "../src/components/sidebar";
import { useSidebar } from "../src/components/sidebar/sidebar";
import type {
  SidebarContextValue,
  SidebarProviderProps,
  SidebarRootProps,
} from "../src/components/sidebar/sidebar";
import { Span } from "../src/components/span/span";
import type { SupportedLocale } from "../src/intl/locale-context";
import { withLocale } from "./locale-matrix";
import { emulateReducedMotion } from "./reduced-motion";
import { finishAnimations, pixelsAt } from "./screenshot-pixels";
import { TOGGLE_COPY } from "./sidebar-contract";

export const DESKTOP = { width: 1024, height: 768 } as const;
export const MOBILE = { width: 500, height: 800 } as const;

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

/** Every part stamps its slot; no data-sidebar anywhere. */
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

/** The two states a menu row compares in the forced-colors suites. */
export const ROW_STATES = ["active", "inactive"] as const;

/**
 * An active and an inactive row of each kind, with the same labels, each followed by a count in a
 * muted `Span`. Each item's test id names the state and the kind: `active-button` and
 * `inactive-button` hold a `MenuButton`, `active-sub` and `inactive-sub` a `MenuSubButton`.
 */
export function StateRows() {
  return (
    <>
      {ROW_STATES.map((state) => (
        <Sidebar.MenuItem key={state} data-testid={`${state}-button`}>
          <Sidebar.MenuButton isActive={state === "active"}>
            Inbox <Span variant="muted">12</Span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      ))}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton>Folders</Sidebar.MenuButton>
        <Sidebar.MenuSub>
          {ROW_STATES.map((state) => (
            <Sidebar.MenuSubItem key={state} data-testid={`${state}-sub`}>
              <Sidebar.MenuSubButton isActive={state === "active"} href={`#${state}`}>
                Drafts <Span variant="muted">3</Span>
              </Sidebar.MenuSubButton>
            </Sidebar.MenuSubItem>
          ))}
        </Sidebar.MenuSub>
      </Sidebar.MenuItem>
    </>
  );
}

/** What a row's end holds in {@link StateRowEnds}. */
const ROW_ENDS = ["icon", "text", "badge"] as const;

/**
 * An active and an inactive row for each end: an action that holds an icon, an action that holds
 * only text, and a count badge. Each item's test id names the state and the end, such as
 * `active-text`. The rows take `size`. With `styled`, each end's content is a child that sets its
 * own muted text color: the icon takes `text-muted-foreground`, and the text and the count sit in
 * a muted `Span`. With `disabled`, every row is `aria-disabled="true"`.
 */
export function StateRowEnds({
  size = "default",
  styled = false,
  disabled = false,
}: {
  size?: "sm" | "default" | "lg";
  styled?: boolean;
  disabled?: boolean;
}) {
  const text = (content: string) => (styled ? <Span variant="muted">{content}</Span> : content);
  return (
    <>
      {ROW_ENDS.flatMap((end) =>
        ROW_STATES.map((state) => (
          <Sidebar.MenuItem key={`${state}-${end}`} data-testid={`${state}-${end}`}>
            <Sidebar.MenuButton
              isActive={state === "active"}
              size={size}
              aria-disabled={disabled ? "true" : "false"}>
              Inbox
            </Sidebar.MenuButton>
            {end === "badge" ? <Sidebar.MenuBadge>{text("24")}</Sidebar.MenuBadge> : null}
            {end === "icon" ? (
              <Sidebar.MenuAction aria-label="More">
                <svg viewBox="0 0 16 16" aria-hidden="true" className={styled ? "text-muted-foreground" : ""}>
                  <rect x="2" y="2" width="12" height="12" fill="currentColor" />
                </svg>
              </Sidebar.MenuAction>
            ) : null}
            {end === "text" ? <Sidebar.MenuAction aria-label="More">{text("…")}</Sidebar.MenuAction> : null}
          </Sidebar.MenuItem>
        ))
      )}
    </>
  );
}

/** The menu item whose test id is `id`, as {@link StateRows} and {@link StateRowEnds} name them. */
export function menuItem(id: string): HTMLElement {
  const element = page.getByTestId(id).element();
  if (!(element instanceof HTMLElement)) throw new Error(`expected the ${id} menu item`);
  return element;
}

const STATE_ROW_SLOT = { button: "sidebar-menu-button", sub: "sidebar-menu-sub-button" } as const;

/** The row of one kind in the {@link StateRows} item whose test id is `${state}-${kind}`. */
export function stateRow(state: string, kind: keyof typeof STATE_ROW_SLOT): HTMLElement {
  return bySlot(STATE_ROW_SLOT[kind], menuItem(`${state}-${kind}`));
}

/** An active and an inactive row, each holding an Avatar and a name. Each item's test id is its state. */
export function AvatarRows() {
  return (
    <>
      {ROW_STATES.map((state) => (
        <Sidebar.MenuItem key={state} data-testid={state}>
          <Sidebar.MenuButton isActive={state === "active"}>
            <Avatar.Root className="size-6">
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
            <span>Ada Lovelace</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      ))}
    </>
  );
}

/**
 * In the {@link AvatarRows} item whose test id is `state`, a pixel inside the avatar left of its
 * initials, and one of the row's own empty end.
 */
export async function avatarAndRow(state: string): Promise<number[][]> {
  const button = bySlot("sidebar-menu-button", menuItem(state));
  const box = button.getBoundingClientRect();
  const circle = bySlot("avatar", button).getBoundingClientRect();
  const middle = Math.floor(circle.top + circle.height / 2 - box.top);
  return pixelsAt(button, [
    [Math.floor(circle.left - box.left) + 3, middle],
    [Math.floor(box.width) - 3, middle],
  ]);
}

/** The fill of the menu button in `entry`, 4px in from its start, at its vertical middle. */
export async function rowFill(entry: HTMLElement): Promise<number[]> {
  const button = bySlot("sidebar-menu-button", entry);
  const [fill] = await pixelsAt(button, [[4, button.getBoundingClientRect().height / 2]]);
  if (fill === undefined) throw new Error("expected a pixel");
  return fill;
}

/**
 * The pixels around a focused menu action, read from one screenshot of its group: `ring`, 1px out
 * of its start edge, where the author focus ring would paint, and `outline`, 1px inside its start
 * edge, 2px inside its end and bottom edges and 1px inside its top edge, on the lines through its
 * center. It finishes the animations of the action's menu item first.
 */
export async function actionOutlinePixels(
  action: HTMLElement
): Promise<{ readonly ring: number[] | undefined; readonly outline: number[][] }> {
  const item = action.closest('[data-slot="sidebar-menu-item"]');
  if (item === null) throw new Error("expected the action's menu item");
  finishAnimations([item]);
  const group = bySlot("sidebar-group");
  const box = action.getBoundingClientRect();
  const origin = group.getBoundingClientRect();
  const across = box.left + box.width / 2 - origin.left;
  const down = box.top + box.height / 2 - origin.top;
  const [ring, ...outline] = await pixelsAt(group, [
    [box.left - origin.left - 1, down],
    [box.left - origin.left + 1, down],
    [box.right - origin.left - 2, down],
    [across, box.top - origin.top + 1],
    [across, box.bottom - origin.top - 2],
  ]);
  return { ring, outline };
}

/**
 * Pins `navigator.platform`, which picks the shortcut's modifier, so a suite reads the same on a
 * macOS workstation and a Linux CI runner. The own property shadows the prototype getter, so a
 * suite deletes it after each test to restore the getter.
 */
export function stubPlatform(platform: "MacIntel" | "Win32"): void {
  Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
}

/** Dispatches a B keydown and waits two frames, so a toggle it causes has committed. */
export async function pressB(
  init: KeyboardEventInit,
  target: EventTarget = window,
  before?: (event: KeyboardEvent) => void
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true, ...init });
  before?.(event);
  target.dispatchEvent(event);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return event;
}

/** The open state, from `useSidebar`, in an output named Open state. */
function OpenStatus() {
  const sidebar = useSidebar();
  return <output aria-label="Open state">{String(sidebar.open)}</output>;
}

/**
 * Two buttons that each queue two `setOpen` updates in one handler, Invert twice and Set then
 * invert, beside an {@link OpenStatus}.
 */
export function QueueControls() {
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

/**
 * A button that inverts `openMobile` in two transitions, and an output named Mobile open state that
 * shows the result once the second transition commits.
 */
export function MobileQueue() {
  const { openMobile, setOpenMobile } = useSidebar();
  const [settled, setSettled] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          startTransition(() => setOpenMobile((open) => !open));
          await Promise.resolve();
          startTransition(() => {
            setOpenMobile((open) => !open);
            setSettled(true);
          });
        }}>
        Invert in two transitions
      </button>
      <output aria-label="Mobile open state">{settled ? String(openMobile) : "pending"}</output>
    </>
  );
}

/**
 * For suites whose contract is state, not motion: with the shell's width tween off, the
 * Trigger in the Inset stops moving as soon as the rail toggles, so a click needs no wait for
 * it to settle. `setupSidebarBrowser`'s afterEach releases the emulation.
 */
export function withoutShellMotion(): void {
  beforeEach(async () => {
    await emulateReducedMotion("reduce");
  });
}
