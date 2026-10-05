"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";

import { tv } from "tailwind-variants";

import { Sidebar, useSidebar } from "@elmeragroup/fuse/sidebar";
import { densityAttributes, ThemeScope } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { useLandingTheme } from "../landing-theme";
import { isTypingTarget } from "../typing-target";
import { useMediaQuery } from "../use-media-query";
import { useSideOverlay, useSideShown } from "../window-side";
import { CommandPalette } from "./command-palette";
import { DashboardContext } from "./dashboard-context";
import type { DashboardApi, Navigation, Notice, Reveal } from "./dashboard-context";
import { DashboardMain } from "./dashboard-main";
import { DEMO_NOW } from "./dashboard-orders";
import type { OrderId } from "./dashboard-orders";
import { DashboardSidebar } from "./dashboard-sidebar";
import { initialState, isQueue, reduce, visibleOrders } from "./dashboard-state";
import { NewOrderSheet } from "./new-order-sheet";

const dashboardApp = tv({
  slots: {
    // The scope is the app's containing block: `transform` makes the Sidebar's fixed rail,
    // every Sheet, Dialog and the toast viewport position against the window, not the viewport.
    // `overflow-clip`, not `overflow-hidden`: a hidden box still scrolls when focus or a popup
    // reaches past its edge, and fixed overlays inside it then scroll with it, short of its edges.
    provider: "h-full min-h-0",
    scope: "relative h-full transform-gpu overflow-clip bg-background text-foreground",
  },
});

const styles = dashboardApp();

/** How long a view "fetches" before its rows replace the skeleton. */
const FETCH_MS = 420;

/** The window's own breakpoint for a detail pane beside the list. */
const SPLIT_QUERY = "(width >= 80rem)";

/** Open overlays keep their keys too, as fields do, out of the window's shortcuts. */
const OVERLAYS = "[role='dialog'], [role='menu'], [role='listbox']";

/** Moves focus one row along the list, from the focused row or else the selected one. */
function moveRowFocus(scope: HTMLElement, by: 1 | -1): void {
  const rows = [...scope.querySelectorAll<HTMLButtonElement>("[data-row]")];
  const focused = rows.findIndex((row) => row === document.activeElement);
  const from =
    focused === -1 ? rows.findIndex((row) => row.getAttribute("aria-current") === "true") : focused;
  const next = rows[from === -1 ? 0 : Math.min(Math.max(from + by, 0), rows.length - 1)];
  next?.focus();
  next?.scrollIntoView({ block: "nearest" });
}

type ShellProps = {
  scope: RefObject<HTMLDivElement | null>;
  setOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * Everything inside the Sidebar provider: the state, the clock, the toasts, the overlays and
 * the keyboard map, provided to every part through `DashboardContext`.
 */
function DashboardShell({ scope, setOpen }: ShellProps): ReactElement {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useSideOverlay(false);
  const [paletteOpen, setPaletteOpen] = useSideOverlay(false);
  const [newOrderOpen, setNewOrderOpen] = useSideOverlay(false);
  const [mountedAt] = useState(() => Date.now());
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const invoker = useRef<HTMLElement | null>(null);
  const palettePopup = useRef<HTMLDivElement>(null);
  const toasts = Toast.useToastManager();
  const { isMobile, setOpenMobile } = useSidebar();
  // Only a queue sits beside its detail; Order search's table keeps the width at every size.
  const wide = useMediaQuery(SPLIT_QUERY, true);
  const splitView = wide && isQueue(state.view);

  useEffect(() => () => clearTimeout(fetchTimer.current), []);

  // The phone's sidebar Sheet keeps its open state in Fuse's Sidebar provider, out of reach of a
  // render-time reset, so it closes in the commit that hides the side, before the browser paints.
  const shown = useSideShown();
  useLayoutEffect(() => {
    if (!shown) {
      setOpenMobile(false);
    }
  }, [shown, setOpenMobile]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((open) => !open);
      return;
    }
    setOpen((open) => !open);
  }, [isMobile, setOpenMobile, setOpen]);

  const fetchList = useCallback(() => {
    setOpenMobile(false);
    setLoading(true);
    clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => {
      setLoading(false);
    }, FETCH_MS);
  }, [setOpenMobile]);

  // The pending reveal. The row it asks for takes `revealed` as its ref, which scrolls the row
  // into view once it has rendered and retires the request: at once when the list already shows
  // the order, or after the fetch when the reveal opened Order search, whose table turns to the
  // row's page first. Any other navigation cancels it, so a view that mounts later never replays it.
  const [revealing, setRevealing] = useState<Reveal | undefined>(undefined);
  const revealed = useCallback((row: HTMLElement | null) => {
    if (row === null) {
      return;
    }
    row.scrollIntoView({ block: "nearest" });
    setRevealing(undefined);
  }, []);

  const navigate = useCallback(
    (action: Navigation) => {
      setRevealing(undefined);
      dispatch(action);
      fetchList();
    },
    [fetchList]
  );

  const notify = useCallback(
    (notice: Notice) => {
      toasts.add({ type: notice.type, title: notice.title, description: notice.description });
    },
    [toasts]
  );

  // Where focus returns when the palette closes. Both openers run with focus inside the window:
  // the palette's buttons live there, and its shortcut listens on the window's scope element.
  // Control+K during the exit animation fires from the closing palette's own field, which the
  // reopen remounts, so the control that opened it before stays the invoker.
  const remember = useCallback(() => {
    const active = document.activeElement;
    if (palettePopup.current?.contains(active) === true) {
      return;
    }
    invoker.current = active instanceof HTMLElement ? active : null;
  }, []);

  const openPalette = useCallback(() => {
    remember();
    setPaletteOpen(true);
  }, [remember, setPaletteOpen]);

  const api = useMemo(
    (): DashboardApi => ({
      state,
      dispatch,
      navigate,
      loading,
      now: () => new Date(DEMO_NOW + (Date.now() - mountedAt)).toISOString(),
      notify,
      openOrder: (id: OrderId) => {
        const shown = visibleOrders(state).some((order) => order.id === id);
        dispatch({ _tag: "Reveal", id });
        if (!shown) {
          fetchList();
        }
        setRevealing({ id });
        // A reveal the current list cannot show lands in Order search, which keeps no split.
        setSheetOpen(!(wide && isQueue(shown ? state.view : "order-search")));
      },
      revealing,
      revealed,
      openPalette,
      openNewOrder: () => {
        setNewOrderOpen(true);
      },
      toggleSidebar,
      splitView,
    }),
    [
      state,
      navigate,
      fetchList,
      loading,
      revealing,
      revealed,
      mountedAt,
      notify,
      toggleSidebar,
      wide,
      splitView,
      openPalette,
      setSheetOpen,
      setNewOrderOpen,
    ]
  );

  // Sidebar.Provider toggles on ⌘B from anywhere on the page and writes the host's
  // `sidebar:state` cookie. The demo stops the key before it reaches the provider, and toggles
  // its own in-memory rail only while focus is inside the window.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.stopPropagation();
      if (scope.current?.contains(document.activeElement) === true) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [scope, toggleSidebar]);

  // Single-key shortcuts are wired on the scope element, so they only ever fire while focus is
  // inside the window and the rest of the landing keeps its keys.
  useEffect(() => {
    const element = scope.current;
    if (element === null) {
      return;
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (paletteOpen) {
          setPaletteOpen(false);
        } else {
          openPalette();
        }
        return;
      }
      if (event.metaKey || event.ctrlKey || isTypingTarget(event.target, OVERLAYS)) {
        return;
      }
      const row =
        event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-row]") : null;
      switch (event.key) {
        case "j":
          event.preventDefault();
          moveRowFocus(element, 1);
          return;
        case "k":
          event.preventDefault();
          moveRowFocus(element, -1);
          return;
        case "x": {
          const id = Number(row?.dataset.orderId);
          if (Number.isInteger(id) && id > 0) {
            event.preventDefault();
            dispatch({ _tag: "Toggle", id });
          }
          return;
        }
        case "c":
          event.preventDefault();
          setNewOrderOpen(true);
          return;
        case "/":
          event.preventDefault();
          openPalette();
          return;
        case "Escape":
          dispatch({ _tag: "ClearChecks" });
          return;
      }
    };
    element.addEventListener("keydown", onKey);
    return () => {
      element.removeEventListener("keydown", onKey);
    };
  }, [scope, paletteOpen, setPaletteOpen, openPalette, setNewOrderOpen]);

  return (
    <DashboardContext value={api}>
      <DashboardSidebar />
      <DashboardMain sheetOpen={sheetOpen && !splitView} onSheetOpenChange={setSheetOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        finalFocus={invoker}
        popup={palettePopup}
      />
      <NewOrderSheet open={newOrderOpen} onOpenChange={setNewOrderOpen} />
    </DashboardContext>
  );
}

/**
 * Dashboard, an internal sales and back-office app, running live on Fuse: the Internal side of
 * the hero window. A `ThemeScope` gives it the internal variant of the brand the landing has
 * picked while the page keeps its own theme. An internal app is dense, so the scope is also a
 * demo stage, whose generated stylesheet sets the dense metrics on it while the page stays
 * comfortable. Its overlays portal into the scope, so they are dense too.
 */
export function DashboardApp(): ReactElement {
  const { theme } = useLandingTheme();
  // The rail's open state lives here, in memory, never in the host's sidebar cookie.
  const [open, setOpenState] = useState(true);
  const scope = useRef<HTMLDivElement>(null);

  return (
    <ThemeScope
      ref={scope}
      theme={{ ...theme, variant: "internal" }}
      className={styles.scope()}
      data-demo-stage
      {...densityAttributes("dense")}>
      <Tooltip.Provider>
        <Toast.Provider>
          <Sidebar.Provider open={open} onOpenChange={setOpenState} className={styles.provider()}>
            <DashboardShell scope={scope} setOpen={setOpenState} />
          </Sidebar.Provider>
          <Toast.Viewport aria-label="Dashboard notifications" />
        </Toast.Provider>
      </Tooltip.Provider>
    </ThemeScope>
  );
}
