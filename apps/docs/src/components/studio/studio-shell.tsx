"use client";

import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import {
  ElmeraGroupLogo,
  Monitor,
  Moon,
  SidebarSimple,
  SlidersHorizontal,
  Sun,
} from "@elmeragroup/fuse/icons";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { COLOR_SCHEMES } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";

import { HOME_PAGE, STUDIO_PAGES } from "../../lib/pages";
import { COLOR_SCHEME_LABELS } from "../../lib/theme";
import { SingleToggle } from "../single-toggle";
import { ChromeScope } from "./chrome-scope";
import { StudioActions } from "./studio-actions";
import { StudioCanvas } from "./studio-canvas";
import { StudioInspector } from "./studio-inspector";
import { StudioNavigator } from "./studio-navigator";
import { studioToasts } from "./studio-persistence";
import { useStudio } from "./studio-state";
import { StudioThemePicker } from "./studio-theme-picker";
import { StudioZoomMenu } from "./studio-zoom-menu";

const studioShell = tv({
  slots: {
    root: "grid h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[15rem_minmax(0,1fr)_17.5rem]",
    bar: "relative z-40 col-span-full flex h-12 min-w-0 items-center gap-2 border-b border-border bg-background px-3 text-foreground",
    wordmark:
      "text-sm font-semibold flex min-h-6 shrink-0 items-center gap-2 rounded-md text-foreground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    mark: "size-5",
    trail: "text-sm flex min-w-0 items-center gap-1.5",
    title: "sm:inline hidden shrink-0 text-muted-foreground",
    divider: "sm:inline hidden text-muted-foreground",
    page: "font-medium truncate",
    end: "ml-auto flex min-w-0 items-center gap-2",
    wordmarkText: "sm:not-sr-only sr-only",
    link: "text-sm flex min-h-7 items-center rounded-md px-2.5 text-muted-foreground no-underline hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    desktop: "hidden items-center gap-2 lg:flex",
    phone: "flex items-center gap-1 lg:hidden",
    panel: "relative z-30 hidden min-h-0 border-border bg-background text-foreground lg:block",
    scroll: "h-full",
    main: "grid min-h-0 min-w-0",
    sheetBody: "px-0",
  },
  variants: {
    side: {
      left: { panel: "border-r" },
      right: { panel: "border-l" },
    },
  },
});

const styles = studioShell();

const SCHEME_ICONS = {
  light: <Sun aria-hidden />,
  dark: <Moon aria-hidden />,
  system: <Monitor aria-hidden />,
} as const satisfies Record<ColorScheme, ReactNode>;

const SCHEME_ITEM_PROPS = {
  light: { "aria-label": COLOR_SCHEME_LABELS.light },
  dark: { "aria-label": COLOR_SCHEME_LABELS.dark },
  system: { "aria-label": COLOR_SCHEME_LABELS.system },
} as const;

/** The chrome's own scheme: light, dark or the visitor's preference. Artboards keep theirs. */
function ChromeSchemeSwitch(): ReactElement {
  const { chromeScheme, setChromeScheme } = useStudio();
  return (
    <SingleToggle
      label="Editor appearance"
      size="sm"
      options={COLOR_SCHEMES}
      labels={SCHEME_ICONS}
      optionProps={SCHEME_ITEM_PROPS}
      value={chromeScheme}
      onValueChange={setChromeScheme}
    />
  );
}

type PanelSheetProps = {
  side: "left" | "right";
  title: string;
  icon: ReactNode;
  /**
   * The panel, given the Sheet's close, for a pick that should reveal the canvas. Closing with
   * an element moves focus to it rather than back to the trigger.
   */
  children: (close: (focus?: HTMLElement) => void) => ReactNode;
};

/** A side panel as a Sheet, for phones, where the canvas takes the whole screen. */
function PanelSheet({ side, title, icon, children }: PanelSheetProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [handoff, setHandoff] = useState<HTMLElement | undefined>(undefined);
  return (
    <Sheet.Root
      side={side}
      open={open}
      onOpenChange={(next) => {
        setHandoff(undefined);
        setOpen(next);
      }}>
      <Sheet.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={title} />}>
        {icon}
      </Sheet.Trigger>
      <Sheet.Content finalFocus={() => handoff ?? true}>
        <Sheet.Header>
          <Sheet.Title>{title}</Sheet.Title>
        </Sheet.Header>
        <Sheet.Body className={styles.sheetBody()}>
          {children((focus) => {
            setHandoff(focus);
            setOpen(false);
          })}
        </Sheet.Body>
      </Sheet.Content>
    </Sheet.Root>
  );
}

/**
 * The theme studio's editor: a top bar, the Pages and Layers panel, the canvas holding the
 * page's artboards, and the inspector. On a phone the canvas fills the screen and both panels
 * open as Sheets from the top bar.
 */
export function StudioShell({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname();
  const page = STUDIO_PAGES.find((candidate) => candidate.href === pathname);

  return (
    <div className={styles.root()} data-studio>
      <ChromeScope render={<header />} className={styles.bar()}>
        <Link href="/" className={styles.wordmark()}>
          <ElmeraGroupLogo variant="mark" className={styles.mark()} aria-hidden />
          <span className={styles.wordmarkText()}>Fuse</span>
        </Link>
        <p className={styles.trail()}>
          <span className={styles.title()}>Theme studio</span>
          <span className={styles.divider()} aria-hidden>
            /
          </span>
          <span className={styles.page()}>{page?.label}</span>
        </p>
        <div className={styles.end()}>
          <StudioThemePicker />
          <StudioActions />
          <div className={styles.desktop()}>
            <StudioZoomMenu />
            <ChromeSchemeSwitch />
            <Link href={HOME_PAGE.href} className={styles.link()}>
              Docs
            </Link>
          </div>
          <div className={styles.phone()}>
            <PanelSheet side="left" title="Pages and layers" icon={<SidebarSimple />}>
              {(close) => <StudioNavigator onPick={close} />}
            </PanelSheet>
            <PanelSheet side="right" title="Inspector" icon={<SlidersHorizontal />}>
              {() => <StudioInspector />}
            </PanelSheet>
          </div>
        </div>
        {/* The studio's toasts wear the chrome's theme; only the viewport needs the provider. */}
        <Toast.Provider toastManager={studioToasts}>
          <Toast.Viewport />
        </Toast.Provider>
      </ChromeScope>
      <ChromeScope
        render={<aside aria-label="Pages and layers" />}
        className={styles.panel({ side: "left" })}>
        <ScrollArea.Root className={styles.scroll()}>
          <StudioNavigator />
        </ScrollArea.Root>
      </ChromeScope>
      <main className={styles.main()}>
        <StudioCanvas>{children}</StudioCanvas>
      </main>
      <ChromeScope render={<aside aria-label="Inspector" />} className={styles.panel({ side: "right" })}>
        <ScrollArea.Root className={styles.scroll()}>
          <StudioInspector />
        </ScrollArea.Root>
      </ChromeScope>
    </div>
  );
}
