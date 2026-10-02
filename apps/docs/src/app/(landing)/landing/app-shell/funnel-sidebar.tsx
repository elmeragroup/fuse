"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { CaretUpDown, FunnelLogo, MagnifyingGlass, Plus } from "@elmeragroup/fuse/icons";
import { Sidebar } from "@elmeragroup/fuse/sidebar";
import { BRANDS } from "@elmeragroup/fuse/theme";

import { PICKER_BRANDS } from "../landing-facts";
import { useLandingTheme } from "../landing-theme";
import { useFunnel } from "./funnel-context";
import { SIGNED_IN } from "./funnel-orders";
import { isListView, openCount } from "./funnel-state";
import { PRIMARY_VIEWS, VIEW_GROUPS } from "./funnel-views";
import type { ViewEntry } from "./funnel-views";
import { Kbd } from "./kbd";

const funnelSidebar = tv({
  slots: {
    // The rail sits inside the window, not the viewport: the window is its containing block.
    root: "h-full",
    workspaceMark:
      "flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-brand text-sidebar-brand-foreground",
    workspaceLogo: "size-4",
    workspaceText: "leading-tight grid min-w-0 flex-1 text-left",
    workspaceName: "text-sm font-semibold truncate",
    workspaceBrand: "text-xs truncate text-sidebar-foreground/70",
    caret: "ml-auto text-sidebar-foreground/60",
    hint: "ml-auto group-data-[collapsible=icon]:hidden",
    menuWidth: "w-60",
    tooltip: "flex items-center gap-2",
    sellerText: "leading-tight grid min-w-0 flex-1 text-left",
    sellerName: "text-sm font-medium truncate",
    sellerTeam: "text-xs truncate text-sidebar-foreground/70",
    avatar: "size-8 shrink-0",
  },
});

const styles = funnelSidebar();

/** The brand workspaces; picking one re-themes the whole landing, as the brand picker does. */
function WorkspaceSwitcher(): ReactElement {
  const { theme, changeBrand } = useLandingTheme();

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            render={
              <Sidebar.MenuButton size="lg" aria-label={`Workspace: ${BRANDS[theme.brand].displayName}`} />
            }>
            <span className={styles.workspaceMark()}>
              <FunnelLogo className={styles.workspaceLogo()} />
            </span>
            <span className={styles.workspaceText()}>
              <span className={styles.workspaceName()}>Funnel</span>
              <span className={styles.workspaceBrand()}>{BRANDS[theme.brand].displayName}</span>
            </span>
            <CaretUpDown className={styles.caret()} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" className={styles.menuWidth()}>
            <DropdownMenu.RadioGroup
              value={theme.brand}
              onValueChange={(value) => {
                const brand = PICKER_BRANDS.find((code) => code === value);
                if (brand !== undefined) {
                  changeBrand(brand);
                }
              }}>
              <DropdownMenu.Label>Workspaces</DropdownMenu.Label>
              {PICKER_BRANDS.map((brand) => (
                <DropdownMenu.RadioItem key={brand} value={brand}>
                  {BRANDS[brand].displayName}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}

/** A collapsed-rail tooltip: the entry's name and its shortcut. */
function TooltipKeys({ label, keys }: { label: string; keys: readonly string[] }): ReactElement {
  return (
    <span className={styles.tooltip()}>
      {label}
      <Kbd keys={keys} />
    </span>
  );
}

function QuickActions(): ReactElement {
  const { openPalette, openNewOrder } = useFunnel();

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          tooltip={{ children: <TooltipKeys label="Search" keys={["⌘", "K"]} /> }}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={openPalette}>
          <MagnifyingGlass />
          <span>Search</span>
          <span className={styles.hint()}>
            <Kbd keys={["⌘", "K"]} />
          </span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          tooltip={{ children: <TooltipKeys label="New order" keys={["C"]} /> }}
          aria-keyshortcuts="C"
          onClick={openNewOrder}>
          <Plus />
          <span>New order</span>
          <span className={styles.hint()}>
            <Kbd keys={["C"]} />
          </span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}

/** One sidebar entry; list views carry a live count of their open orders, as Linear counts open issues. */
function ViewRow({ entry }: { entry: ViewEntry }): ReactElement {
  const { state, navigate } = useFunnel();
  const active = state.view === entry.view;
  const count = isListView(entry.view) ? openCount(state.orders, entry.view) : 0;
  const Icon = entry.icon;

  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton
        isActive={active}
        aria-current={active ? "page" : "false"}
        tooltip={entry.label}
        onClick={() => {
          navigate({ _tag: "Open", view: entry.view });
        }}>
        <Icon />
        <span>{entry.label}</span>
      </Sidebar.MenuButton>
      {count > 0 ? <Sidebar.MenuBadge>{count}</Sidebar.MenuBadge> : null}
    </Sidebar.MenuItem>
  );
}

function SellerMenu(): ReactElement {
  const { notify } = useFunnel();
  const [beta, setBeta] = useState(false);

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            render={<Sidebar.MenuButton size="lg" aria-label={`Signed in as ${SIGNED_IN.name}`} />}>
            <Avatar.Root className={styles.avatar()}>
              <Avatar.Fallback>{SIGNED_IN.initials}</Avatar.Fallback>
            </Avatar.Root>
            <span className={styles.sellerText()}>
              <span className={styles.sellerName()}>{SIGNED_IN.name}</span>
              <span className={styles.sellerTeam()}>{SIGNED_IN.team}</span>
            </span>
            <CaretUpDown className={styles.caret()} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="top" align="start" className={styles.menuWidth()}>
            <DropdownMenu.Label>{SIGNED_IN.name}</DropdownMenu.Label>
            <DropdownMenu.CheckboxItem
              checked={beta}
              onCheckedChange={(next) => {
                setBeta(next);
                notify({
                  type: "info",
                  title: next ? "Core beta mode on" : "Core beta mode off",
                  description: next ? "New orders go to the Core beta API." : "New orders go to Core.",
                });
              }}>
              Core beta mode
            </DropdownMenu.CheckboxItem>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}

/**
 * Funnel's sidebar: the workspace switcher, search and New order, the primary queues, Funnel's
 * three groups and the signed-in seller. It collapses to icons on desktop and becomes the
 * Sidebar's own Sheet on phones.
 */
export function FunnelSidebar(): ReactElement {
  return (
    <Sidebar.Root collapsible="icon" variant="inset" className={styles.root()}>
      <Sidebar.Header>
        <WorkspaceSwitcher />
        <QuickActions />
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.Menu>
            {PRIMARY_VIEWS.map((entry) => (
              <ViewRow key={entry.view} entry={entry} />
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
        {VIEW_GROUPS.map((group) => (
          <Sidebar.Group key={group.label}>
            <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {group.entries.map((entry) => (
                <ViewRow key={entry.view} entry={entry} />
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        ))}
      </Sidebar.Content>
      <Sidebar.Footer>
        <SellerMenu />
      </Sidebar.Footer>
    </Sidebar.Root>
  );
}
