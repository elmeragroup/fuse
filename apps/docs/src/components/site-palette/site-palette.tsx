"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

import { usePathname, useRouter } from "next/navigation";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Command } from "@elmeragroup/fuse/command";
import type { CommandRootProps } from "@elmeragroup/fuse/command";
import { Check, MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { Kbd, KbdGroup } from "@elmeragroup/fuse/kbd";
import type { CreateToastManagerReturnValue } from "@elmeragroup/fuse/toast";

import { useModifierKey } from "../../lib/modifier-key";
import { matchesEveryToken } from "../../lib/search";
import {
  COMPONENT_ROWS,
  COMPONENTS_PAGE,
  HOME_PAGE,
  homeGroups,
  settingsPageId,
  sitePaletteModel,
} from "./site-palette-model";
import type {
  CopyTarget,
  SettingOption,
  SiteAction,
  SiteCommand,
  SiteGroup,
  SitePaletteModel,
  SiteRow,
  SiteSettings,
} from "./site-palette-model";

const sitePalette = tv({
  slots: {
    trigger: "shrink-0",
    triggerLabel: "xl:not-sr-only sr-only",
    triggerKeys: "xl:inline-flex hidden",
    title: "min-w-0 flex-1 truncate",
    hint: "text-xs shrink-0 text-muted-foreground in-data-highlighted:text-accent-foreground",
    check: "size-4 shrink-0",
  },
});

const styles = sitePalette();

/** The toasts the palette reports a copy in: a Fuse toast manager. */
export type SitePaletteToasts = Pick<CreateToastManagerReturnValue, "add">;

type Registration = { readonly key: string; readonly commands: readonly SiteCommand[] };

type Registry = {
  readonly register: (key: string, commands: readonly SiteCommand[]) => void;
  readonly unregister: (key: string) => void;
};

/**
 * The registry has a context of its own, whose value never changes, so a component that registers
 * commands does not re-render when the palette's state does.
 */
const RegistryContext = createContext<Registry | null>(null);

type OpenChange = NonNullable<CommandRootProps["onOpenChange"]>;

type SitePaletteValue = {
  readonly open: boolean;
  /** Opens the palette on its first page with an empty field. */
  readonly show: () => void;
  /**
   * The count of openings. The first page is keyed by it, so an opening that interrupts the
   * previous close mounts the search fresh, with the first row highlighted.
   */
  readonly opening: number;
  readonly stack: readonly string[];
  readonly setStack: (stack: readonly string[]) => void;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  /** The rows on screen, which stay as they were while the palette closes. */
  readonly model: SitePaletteModel;
  readonly onOpenChange: OpenChange;
  readonly onOpenChangeComplete: (open: boolean) => void;
  readonly run: (action: SiteAction) => void;
  readonly pick: (option: SettingOption) => void;
};

const SitePaletteContext = createContext<SitePaletteValue | null>(null);

function useSitePalette(part: string): SitePaletteValue {
  const value = use(SitePaletteContext);
  if (value === null) {
    throw new Error(`${part} must be used within SitePaletteProvider`);
  }
  return value;
}

const FIRST_PAGE: readonly string[] = [HOME_PAGE];

/** ⌘K or Ctrl+K, the pair the trigger's `aria-keyshortcuts` names, without Alt. */
function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k";
}

function copiedText(target: CopyTarget): string {
  switch (target._tag) {
    case "Text":
      return target.text;
    case "PageLink":
      return window.location.href;
    case "SiteUrl":
      return new URL(target.path, window.location.origin).href;
  }
}

async function copy(toasts: SitePaletteToasts, target: CopyTarget, notice: string): Promise<void> {
  const text = copiedText(target);
  try {
    // Rejects too where there is no clipboard at all, as on insecure origins.
    await navigator.clipboard.writeText(text);
  } catch {
    toasts.add({ type: "error", title: "Could not copy", description: "The browser refused the clipboard." });
    return;
  }
  toasts.add({ type: "success", title: notice, description: text });
}

type Router = ReturnType<typeof useRouter>;

/**
 * Goes to a site address. A route goes through the Next router. An anchor on the page on screen
 * goes through the address's hash, as an in-page link does, so the hash listeners on the page
 * hear it; the same hash again scrolls to its element, which a hash assignment would not.
 */
function navigate(router: Router, href: string): void {
  const url = new URL(href, window.location.href);
  if (url.pathname !== window.location.pathname || url.hash === "") {
    router.push(href);
    return;
  }
  if (url.hash === window.location.hash) {
    document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
    return;
  }
  window.location.hash = url.hash;
}

/** `SitePaletteProvider` takes the surface's settings and toasts. */
export type SitePaletteProviderProps = {
  /** The surface's settings drill-downs and settings commands. Memoize it. */
  readonly settings: SiteSettings;
  /** Where a copy action reports what it copied. */
  readonly toasts: SitePaletteToasts;
  readonly children: ReactNode;
};

/**
 * The site palette's state for one surface: whether it is open, its page stack and query, and the
 * commands the surface's components register. ⌘K and Ctrl+K toggle it from anywhere in the
 * document, since the listener captures the key before any other handler sees it. Render one per
 * root layout, around the surface's chrome, and place `SitePaletteDialog` inside it.
 */
export function SitePaletteProvider({ settings, toasts, children }: SitePaletteProviderProps): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<readonly string[]>(FIRST_PAGE);
  const [query, setQuery] = useState("");
  const [registrations, setRegistrations] = useState<readonly Registration[]>([]);
  const [opening, setOpening] = useState(0);
  // What a row asked to run once the palette has closed.
  const afterClose = useRef<(() => void) | null>(null);

  // Every opening starts on the first page with an empty field, including one that interrupts the
  // previous close, which never reaches `onOpenChangeComplete`.
  const show = useCallback(() => {
    afterClose.current = null;
    setStack(FIRST_PAGE);
    setQuery("");
    setOpening((count) => count + 1);
    setOpen(true);
  }, []);

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    // Chrome and Firefox bind ⌘K and Ctrl+K to the address bar.
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    if (open) {
      setOpen(false);
    } else {
      show();
    }
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPaletteShortcut(event)) {
        onShortcut(event);
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, []);

  const registry = useMemo<Registry>(
    () => ({
      // A registration keeps its place when its commands change, so the rows keep their order.
      register: (key, commands) => {
        setRegistrations((current) =>
          current.some((entry) => entry.key === key)
            ? current.map((entry) => (entry.key === key ? { key, commands } : entry))
            : [...current, { key, commands }]
        );
      },
      unregister: (key) => {
        setRegistrations((current) => current.filter((entry) => entry.key !== key));
      },
    }),
    []
  );

  const commands = useMemo(() => registrations.flatMap((entry) => entry.commands), [registrations]);
  const live = useMemo(() => sitePaletteModel(pathname, commands, settings), [pathname, commands, settings]);
  // A row that changes the route or a setting changes the rows while the dialog still fades out.
  // The palette shows the rows it showed until it opens again, as the Command docs' app palette
  // does.
  const [shown, setShown] = useState(live);
  if (open && shown !== live) {
    setShown(live);
  }

  const value = useMemo<SitePaletteValue>(() => {
    const close = () => {
      setOpen(false);
    };
    return {
      open,
      show,
      opening,
      stack,
      setStack,
      query,
      setQuery,
      model: shown,
      onOpenChange: (next, details) => {
        // Escape goes back a page, and closes the palette only from the first page.
        if (!next && details.reason === "escape-key" && stack.length > 1) {
          details.cancel();
          setStack(stack.slice(0, -1));
          return;
        }
        setOpen(next);
      },
      onOpenChangeComplete: (isOpen) => {
        if (isOpen) {
          return;
        }
        setStack(FIRST_PAGE);
        setQuery("");
        const pending = afterClose.current;
        afterClose.current = null;
        if (pending !== null) {
          // Base UI releases the page's scroll lock in a zero-delay timeout and restores the scroll
          // position it saved. A navigation before then would land at the old position, so it waits
          // for the timeout queued first.
          setTimeout(pending, 0);
        }
      },
      run: (action) => {
        switch (action._tag) {
          case "OpenPage":
            // `Command.PageTrigger` pushes the page itself.
            return;
          case "Run":
            close();
            action.run();
            return;
          case "Copy":
            close();
            void copy(toasts, action.target, action.notice);
            return;
          case "OpenOverlay":
            afterClose.current = action.open;
            close();
            return;
          case "Navigate":
            afterClose.current = () => {
              navigate(router, action.href);
            };
            close();
            return;
        }
      },
      pick: (option) => {
        if (option.state === "unavailable") {
          return;
        }
        close();
        option.apply();
      },
    };
  }, [open, show, opening, stack, query, shown, toasts, router]);

  return (
    <RegistryContext.Provider value={registry}>
      <SitePaletteContext.Provider value={value}>{children}</SitePaletteContext.Provider>
    </RegistryContext.Provider>
  );
}

/**
 * Adds a client surface's commands to the palette's "This page" group while the component that
 * calls it is mounted. Several components may register; their commands follow each other in the
 * order they first registered. Pass the same array until the commands change, as `useMemo` does,
 * or the palette updates on every render.
 *
 * @param commands - The commands, in the order the group lists them.
 */
export function useSiteCommands(commands: readonly SiteCommand[]): void {
  const registry = use(RegistryContext);
  if (registry === null) {
    throw new Error("useSiteCommands must be used within SitePaletteProvider");
  }
  const key = useId();
  const { register, unregister } = registry;
  useEffect(() => {
    register(key, commands);
  }, [register, key, commands]);
  // Leaving is a separate effect, so a change of commands updates the registration in place.
  useEffect(
    () => () => {
      unregister(key);
    },
    [unregister, key]
  );
}

/** The search button for a surface's top bar. ⌘K and Ctrl+K open the same palette. */
export function SitePaletteTrigger(): ReactElement {
  const { open, show } = useSitePalette("SitePaletteTrigger");
  const modifier = useModifierKey();
  return (
    <Button
      variant="outline"
      size="sm"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Meta+K Control+K"
      className={styles.trigger()}
      onClick={show}>
      <MagnifyingGlass data-icon="inline-start" aria-hidden />
      <span className={styles.triggerLabel()}>Search</span>
      <KbdGroup aria-hidden className={styles.triggerKeys()}>
        <Kbd>{modifier}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </Button>
  );
}

function rowText(row: SiteRow): string {
  return row.title;
}

/** The Components and settings pages match every word of the query, as the first page does. */
function rowMatches(row: SiteRow, query: string): boolean {
  return matchesEveryToken(row.title, query);
}

function optionMatches(option: SettingOption, query: string): boolean {
  return matchesEveryToken(option.label, query);
}

/** One row of the first page or the Components page. */
function SiteRowItem({ row, run }: { row: SiteRow; run: (action: SiteAction) => void }): ReactElement {
  if (row.action._tag === "OpenPage") {
    return (
      <Command.PageTrigger value={row} page={row.action.page}>
        <span className={styles.title()}>{row.title}</span>
      </Command.PageTrigger>
    );
  }
  const { shortcut } = row;
  return (
    <Command.Item
      value={row}
      disabled={row.disabled}
      aria-keyshortcuts={shortcut?.aria}
      onClick={() => {
        run(row.action);
      }}>
      <span className={styles.title()}>{row.title}</span>
      {row.hint === undefined ? null : <span className={styles.hint()}>{row.hint}</span>}
      {shortcut === undefined ? null : (
        <Command.Shortcut>
          {shortcut.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </Command.Shortcut>
      )}
    </Command.Item>
  );
}

/** The key hints of a page above the first, where Escape goes back. */
function SubPageFooter(): ReactElement {
  return (
    <Command.Footer>
      <Command.NavigateHint />
      <Command.SelectHint />
      <Command.BackHint />
      <Command.CloseHint>Back</Command.CloseHint>
    </Command.Footer>
  );
}

/**
 * The palette's dialog. Its first page holds the query above the search and ranks every row with
 * the docs' own scorer, so Base UI's filter is off there. The Components page and each settings
 * page filter their own rows. Place it inside `SitePaletteProvider`, where its popup should take
 * its theme: the popup portals into the nearest theme scope.
 */
export function SitePaletteDialog(): ReactElement {
  const {
    open,
    opening,
    stack,
    setStack,
    query,
    setQuery,
    model,
    onOpenChange,
    onOpenChangeComplete,
    run,
    pick,
  } = useSitePalette("SitePaletteDialog");
  const groups = useMemo(() => homeGroups(model, query), [model, query]);
  return (
    <Command.Root
      open={open}
      pages={stack}
      onPagesChange={setStack}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}>
      <Command.Content aria-label="Site search">
        <Command.Page
          key={opening}
          id={HOME_PAGE}
          label="Search the site"
          grouped
          items={groups}
          filter={null}
          value={query}
          onValueChange={setQuery}
          itemToStringValue={rowText}>
          <Command.Input placeholder="Search pages, demos and commands…" />
          <Command.Empty>Nothing matches “{query}”.</Command.Empty>
          <Command.List>
            {(group: SiteGroup) => (
              <Command.Group key={group.value} items={group.items}>
                <Command.Label>{group.value}</Command.Label>
                <Command.Collection>
                  {(row: SiteRow) => <SiteRowItem key={row.id} row={row} run={run} />}
                </Command.Collection>
              </Command.Group>
            )}
          </Command.List>
          <Command.Footer>
            <Command.NavigateHint />
            <Command.SelectHint />
            <Command.CloseHint />
          </Command.Footer>
        </Command.Page>
        <Command.Page
          id={COMPONENTS_PAGE}
          label="Components"
          items={COMPONENT_ROWS}
          filter={rowMatches}
          itemToStringValue={rowText}>
          <Command.Input placeholder="Search components…" />
          <Command.Empty />
          <Command.List>{(row: SiteRow) => <SiteRowItem key={row.id} row={row} run={run} />}</Command.List>
          <SubPageFooter />
        </Command.Page>
        {model.settingsPages.map((page) => (
          <Command.Page
            key={page.id}
            id={settingsPageId(page)}
            label={page.label}
            items={page.options}
            filter={optionMatches}
            itemToStringValue={(option) => option.label}>
            <Command.Input placeholder={`Search ${page.label.toLowerCase()}…`} />
            <Command.Empty />
            <Command.List>
              {(option: SettingOption) => (
                <Command.Item
                  key={option.id}
                  value={option}
                  disabled={option.state === "unavailable"}
                  aria-current={option.state === "current" ? "true" : undefined}
                  onClick={() => {
                    pick(option);
                  }}>
                  <span className={styles.title()}>{option.label}</span>
                  {option.state === "current" ? <Check aria-hidden className={styles.check()} /> : null}
                </Command.Item>
              )}
            </Command.List>
            <SubPageFooter />
          </Command.Page>
        ))}
      </Command.Content>
    </Command.Root>
  );
}
