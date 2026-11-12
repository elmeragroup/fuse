"use client";

import { createContext, use, useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Menu } from "@base-ui/react/menu";
import { cn, tv } from "tailwind-variants";

import { CaretDown, CaretRight, Check, SlidersHorizontal } from "@elmeragroup/fuse/icons";

/*
 * ExpandableMenu: a Base UI Menu whose trigger becomes the menu, after Bloom by Josh Puckett
 * (github.com/joshpuckett/bloom). Every part is a Base UI Menu part, so roles, focus, typeahead,
 * arrow keys, Esc and outside press are Base UI's. What it adds is presentation and one policy:
 *
 * - The popup lies over its trigger and is clipped to the trigger's circle on Base UI's starting
 *   and ending frames, so the trigger grows into the menu and shrinks back into it
 *   (`styles/globals.css`). An open or close from the keyboard skips that motion.
 * - The menu grows down from its trigger, toward the inline end, while five rows and its width fit
 *   that way, and the other way where only that way fits. A submenu grows the same way from its row.
 * - Values never close the menu. A submenu commits: choosing a value closes that submenu only.
 * - A submenu opens in place over its own row, a little wider, and the menu behind it sinks.
 *
 * Its sizes are the `--expandable-menu-*` lengths in `styles/globals.css`. The parts render with
 * them, and the menu reads them as it opens to choose its side and its submenus' offsets.
 */

const expandableMenu = tv({
  slots: {
    // The circle takes presses 6px past its edge, 40px across at its 28px, and 8px past it, 44px
    // across, under a coarse pointer, through an unpainted pseudo-element. Its footer keeps the
    // stage and the view switch beyond that reach.
    trigger:
      "relative inline-flex size-(--expandable-menu-pip) cursor-default items-center justify-center rounded-full text-muted-foreground outline-none before:absolute before:-inset-1.5 before:rounded-full hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:before:-inset-2 [&_svg]:size-4",
    positioner: "z-50 outline-none",
    // Never taller than the room Base UI measures beside the trigger; the rows scroll instead.
    popup:
      "relative flex max-h-(--available-height) w-(--expandable-menu-width) flex-col bg-popover text-popover-foreground outline-none",
    // The title keeps the rows' 12px inset on the side away from the pip.
    header: "flex h-(--expandable-menu-pip) shrink-0 items-center gap-2 pe-3",
    pip: "relative inline-flex size-(--expandable-menu-pip) shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4",
    title: "text-sm font-medium flex min-w-0 flex-1 items-baseline gap-1.5 truncate pt-0.5",
    body: "flex min-h-0 flex-col overflow-y-auto p-(--expandable-menu-inset)",
    // Rows keep their height in a capped popup, where the body scrolls instead of squeezing them.
    row: "text-sm flex h-(--expandable-menu-row) w-full shrink-0 cursor-default items-center gap-2 rounded-xl px-2 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0",
    rowLabel: "flex-1 truncate text-start",
    rowValue: "text-xs max-w-24 truncate font-mono text-muted-foreground",
    subtrigger: "data-[popup-open]:bg-accent",
    // The parent popup's width, so it reads an inset wider than its row each side and keeps that
    // width while the parent sinks. Its height cap is in `styles/globals.css`.
    sub: "flex w-(--expandable-menu-width) flex-col bg-popover p-(--expandable-menu-inset) text-popover-foreground outline-none",
    subHeader:
      "text-sm flex h-(--expandable-menu-row) shrink-0 cursor-default items-center gap-2 rounded-xl px-2 [&_svg]:size-4 [&_svg]:shrink-0",
    subBody: "flex min-h-0 flex-col overflow-y-auto",
    indicator: "ms-auto inline-flex",
    switchTrack:
      "ease-out inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-muted-foreground/25 p-0.5 transition-colors duration-150 group-data-[checked]/check:bg-primary",
    switchThumb: "shadow-xs size-3 rounded-full bg-background group-data-[checked]/check:translate-x-3",
    groupLabel: "text-xs shrink-0 truncate px-2 pt-2 pb-1 font-mono text-muted-foreground",
    separator: "mx-2 my-1 h-px shrink-0 bg-border",
  },
});

const styles = expandableMenu();

/**
 * Merges a part's classes with a caller's `className`, keeping Base UI's state callback a
 * callback. Fuse's own `mergeClassName` (`packages/fuse/src/styles/merge-class-name.ts`) is
 * private to the package, so this mirrors it until the menu graduates.
 */
function mergeClassName<State>(
  className: string | ((state: State) => string | undefined) | undefined,
  base: string
): string | ((state: State) => string) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public className contract explicitly accepts strings or state callbacks.
  if (typeof className === "function") return (state) => cn(base, className(state)) ?? base;
  return cn(base, className) ?? base;
}

/** How far both positioners keep their popups from the viewport's edges, in px. */
const COLLISION_PADDING = 5;

/** How many rows a menu must show to open toward a side: the policy, apart from the sizes. */
const ROWS_IN_VIEW = 5;

/**
 * The menu's sizes in px, as the `--expandable-menu-*` lengths in `styles/globals.css` compute
 * where they are read: registered lengths, so the browser resolves their rems.
 */
type MenuGeometry = {
  /** The trigger's circle, and the menu's header. */
  readonly pip: number;
  /** A row, and a submenu's header. */
  readonly row: number;
  /** The padding between a popup's edge and its rows. */
  readonly inset: number;
  /** A popup's width. */
  readonly width: number;
};

/** Reads the menu's sizes where `element`, a trigger or a part inside a popup, inherits them. */
function geometryOf(element: Element): MenuGeometry {
  const style = getComputedStyle(element);
  const length = (name: string): number => Number.parseFloat(style.getPropertyValue(name));
  return {
    pip: length("--expandable-menu-pip"),
    row: length("--expandable-menu-row"),
    inset: length("--expandable-menu-inset"),
    width: length("--expandable-menu-width"),
  };
}

/** The room a popup whose header is `header` px tall needs on a side to show its rows there. */
function roomFor(geometry: MenuGeometry, header: number): number {
  return header + 2 * geometry.inset + ROWS_IN_VIEW * geometry.row + COLLISION_PADDING;
}

/** The side a menu grows to, chosen as it opens. */
type MenuSide = "bottom" | "top";

/**
 * The side a popup whose header lies on `anchor` grows to: `preferred`, unless only the other side
 * has `room`.
 */
function sideFor(anchor: Element, preferred: MenuSide, room: number): MenuSide {
  const { top, bottom } = anchor.getBoundingClientRect();
  const fits = { bottom: document.documentElement.clientHeight - top >= room, top: bottom >= room };
  const other = preferred === "bottom" ? "top" : "bottom";
  return !fits[preferred] && fits[other] ? other : preferred;
}

/**
 * Where the menu lies against its trigger: the side it grows to, its Base UI alignment, and the
 * physical edge its trigger sits at, which its clip starts from in either writing direction.
 */
type MenuPlacement = {
  readonly side: MenuSide;
  readonly align: "start" | "end";
  readonly triggerAt: "left" | "right";
};

/**
 * Places a menu opening from `trigger`: down while it has the room, and toward the inline end of
 * the document it portals into while its width fits that way, else the way that fits. Where
 * neither fits, it keeps the preferred way and Base UI shifts it into the viewport.
 */
function placementFrom(trigger: Element): MenuPlacement {
  const geometry = geometryOf(trigger);
  const side = sideFor(trigger, "bottom", roomFor(geometry, geometry.pip));
  const { left, right } = trigger.getBoundingClientRect();
  const width = geometry.width + COLLISION_PADDING;
  const ltr = getComputedStyle(document.body).direction !== "rtl";
  const fitsRightward = document.documentElement.clientWidth - left >= width;
  const fitsLeftward = right >= width;
  const rightward = ltr ? fitsRightward || !fitsLeftward : !fitsLeftward && fitsRightward;
  return {
    side,
    align: rightward === ltr ? "start" : "end",
    triggerAt: rightward ? "left" : "right",
  };
}

/** Whether an open or close came from the keyboard or a pointer. */
type InputOrigin = "keyboard" | "pointer";

/**
 * The origin of the event behind an open, a close or a choice. A key, such as an arrow or Esc, is
 * the keyboard. So is the click Enter or Space dispatches on a button, which carries no pointer
 * type and no click count, where a pointer's press always has both.
 */
function originOf(event: Event | undefined): InputOrigin {
  if (event instanceof KeyboardEvent) return "keyboard";
  if (event instanceof PointerEvent) return event.pointerType === "" ? "keyboard" : "pointer";
  return event instanceof MouseEvent && event.detail === 0 ? "keyboard" : "pointer";
}

/**
 * The origin of a Base UI open or close. Focus leaving the menu, `focus-out`, is keyboard
 * navigation whatever its event: Tab reports the focus landing past the menu, Shift+Tab its key,
 * and a pointer's press elsewhere closes the menu as `outside-press` before any focus moves.
 */
function originOfChange({ reason, event }: Menu.Root.ChangeEventDetails): InputOrigin {
  return reason === "focus-out" ? "keyboard" : originOf(event);
}

/** What a menu's parts share: where it lies, and the origin of its last open or close. */
type MenuState = MenuPlacement & { readonly origin: InputOrigin };

/** A menu's state before its first open. */
const UNOPENED: MenuState = { side: "bottom", align: "start", triggerAt: "left", origin: "pointer" };

const MenuContext = createContext<MenuState>(UNOPENED);

/**
 * Closes the nearest submenu with the details of the choice that commits it, so a choice made
 * from the keyboard closes it at once.
 */
const CommitContext = createContext<((details: Menu.RadioGroup.ChangeEventDetails) => void) | null>(null);

/**
 * Base UI's `Menu.Root`, which also places the menu as it opens and notes the origin of each open
 * and close, for its trigger, popup and submenus. An origin holds until its open or close has
 * landed, so a later change of the menu, such as a submenu sinking it, moves as usual.
 *
 * @param props - Base UI `Menu.Root` props.
 * @returns The root.
 */
function Root({ onOpenChange, onOpenChangeComplete, ...props }: Menu.Root.Props): ReactElement {
  const [state, setState] = useState<MenuState>(UNOPENED);
  return (
    <MenuContext value={state}>
      <Menu.Root
        {...props}
        onOpenChange={(open, details) => {
          onOpenChange?.(open, details);
          if (details.isCanceled) return;
          const placement = open && details.trigger !== undefined ? placementFrom(details.trigger) : state;
          setState({ ...placement, origin: originOfChange(details) });
        }}
        onOpenChangeComplete={(open) => {
          onOpenChangeComplete?.(open);
          setState((current) => ({ ...current, origin: "pointer" }));
        }}
      />
    </MenuContext>
  );
}

/** `data-keyboard`, present while an open or close from the keyboard lands. */
function keyboardMark(origin: InputOrigin): "" | undefined {
  return origin === "keyboard" ? "" : undefined;
}

/**
 * The round ghost button the menu grows out of, showing a sliders icon.
 *
 * @param props - Base UI `Menu.Trigger` props.
 * @returns The trigger.
 */
function Trigger({
  className,
  ...props
}: Omit<ComponentProps<typeof Menu.Trigger>, "children">): ReactElement {
  const { origin } = use(MenuContext);
  return (
    <Menu.Trigger
      data-slot="expandable-menu-trigger"
      data-keyboard={keyboardMark(origin)}
      className={mergeClassName(className, styles.trigger())}
      {...props}>
      <SlidersHorizontal aria-hidden />
    </Menu.Trigger>
  );
}

/**
 * Called by a submenu as it opens with the row it opens over and the side it grows to, so the menu
 * sinks around the edge of the row the submenu's header meets, and that edge stays put.
 */
const SinkContext = createContext<((row: HTMLElement, side: MenuSide) => void) | null>(null);

type PopupProps = ComponentProps<typeof Menu.Popup> & {
  /** What the menu edits, beside the pip at the trigger's spot. */
  header: ReactNode;
};

/**
 * The menu, laid over its trigger. The positioner sits on the trigger's own rect, through a
 * negative offset of the trigger's height, so the popup's corner is the trigger's and the clip
 * grows from there, to the side and the way the root chose. Grown upward, its header, with the pip
 * in it, sits at the bottom, still on the trigger.
 *
 * @param props - Base UI `Menu.Popup` props, plus the header.
 * @returns The portalled popup.
 */
function Popup({ header, children, className, ...props }: PopupProps): ReactElement {
  const { side, align, triggerAt, origin } = use(MenuContext);
  // The edge of the open submenu's row its header meets, from the popup's top, in layout px.
  const [sinkAt, setSinkAt] = useState(0);
  const sinkUnder = (row: HTMLElement, rowSide: MenuSide): void => {
    const scrolled = row.closest('[data-slot="expandable-menu-body"]')?.scrollTop ?? 0;
    setSinkAt(row.offsetTop - scrolled + (rowSide === "top" ? row.offsetHeight : 0));
  };
  return (
    <Menu.Portal>
      <Menu.Positioner
        data-slot="expandable-menu-positioner"
        className={styles.positioner()}
        style={{ "--expandable-menu-sink-at": `${String(sinkAt)}px` }}
        side={side}
        align={align}
        sideOffset={({ anchor }) => -anchor.height}
        collisionPadding={COLLISION_PADDING}
        // The root chose the side and the way; the popup caps at the room there and its rows
        // scroll. Only where its width fits neither way does Base UI shift it in.
        collisionAvoidance={{ side: "none", align: "shift" }}>
        <Menu.Popup
          data-slot="expandable-menu-popup"
          data-keyboard={keyboardMark(origin)}
          data-trigger-at={triggerAt}
          className={mergeClassName(className, styles.popup())}
          {...props}>
          <div data-slot="expandable-menu-header" className={styles.header()}>
            <span aria-hidden className={styles.pip()}>
              <SlidersHorizontal data-slot="expandable-menu-pip" />
            </span>
            <div data-slot="expandable-menu-title" className={styles.title()}>
              {header}
            </div>
          </div>
          <div data-slot="expandable-menu-body" className={styles.body()}>
            <SinkContext value={sinkUnder}>{children}</SinkContext>
          </div>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

type SubmenuProps = {
  /** The row's label, such as the prop name. */
  label: string;
  /** The current value, shown at the row's end. */
  value: ReactNode;
  /** The options, usually one RadioGroup. */
  children: ReactNode;
  /** Called when the submenu opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called with the value of the option the reader is on, by pointer or keyboard, or `null` when
   * none. Highlights Base UI places on its own, as when the submenu opens, are left out.
   */
  onHighlight?: (value: string | null) => void;
};

/** A submenu's state: whether it is open, where it grows, and the origin of its last open or close. */
type SubmenuState = {
  readonly open: boolean;
  readonly side: MenuSide;
  /** The popup's inset, which its header overlaps its row by on the side it grows from. */
  readonly inset: number;
  readonly origin: InputOrigin;
};

/**
 * A row that opens its options in place over itself, a little wider, while the menu behind it
 * sinks a little around the row. Its open state is its own, so its RadioGroup can commit it: the
 * submenu closes and the menu stays. It opens on the checked option. Base UI's menus take no
 * selected index, and its list navigation follows focus, so the submenu focuses the checked item
 * in the frame after the popup mounts, after Base UI's own first highlight.
 *
 * It grows to the side its menu grew to, unless only the row's other side has room for five
 * options, and stays on its row: it is capped at the room it has and its options scroll, and only
 * its alignment shifts back into the viewport.
 *
 * @param props - The row's label and value, the options, and the open and highlight callbacks.
 * @returns The submenu.
 */
function Submenu({ label, value, children, onOpenChange, onHighlight }: SubmenuProps): ReactElement {
  const menu = use(MenuContext);
  const sinkUnder = use(SinkContext);
  const [state, setState] = useState<SubmenuState>({
    open: false,
    side: menu.side,
    inset: 0,
    origin: "pointer",
  });
  const row = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  // Every open and close passes through here with the origin of its input.
  const setOpen = (open: boolean, origin: InputOrigin): void => {
    if (open && row.current !== null) {
      const geometry = geometryOf(row.current);
      const side = sideFor(row.current, menu.side, roomFor(geometry, geometry.row));
      sinkUnder?.(row.current, side);
      setState({ open, side, inset: geometry.inset, origin });
    } else {
      setState((current) => ({ ...current, open, origin }));
    }
    onOpenChange?.(open);
  };
  const { open, side, inset, origin } = state;
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      popup.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const rowContent = (
    <>
      <span className={styles.rowLabel()}>{label}</span>
      <span className={styles.rowValue()}>{value}</span>
    </>
  );
  return (
    <CommitContext value={(details) => setOpen(false, originOf(details.event))}>
      <Menu.SubmenuRoot
        open={open}
        onOpenChange={(next, details) => setOpen(next, originOfChange(details))}
        onOpenChangeComplete={() => setState((current) => ({ ...current, origin: "pointer" }))}
        onItemHighlighted={(item, details) => {
          if (details.reason !== "none") onHighlight?.(item?.dataset.value ?? null);
        }}>
        <Menu.SubmenuTrigger
          ref={row}
          openOnHover={false}
          data-slot="expandable-menu-submenu-trigger"
          data-keyboard={keyboardMark(origin)}
          className={styles.row({ className: styles.subtrigger() })}>
          {rowContent}
          <CaretRight aria-hidden className="text-muted-foreground" />
        </Menu.SubmenuTrigger>
        <Menu.Portal>
          <Menu.Positioner
            data-slot="expandable-menu-positioner"
            className={styles.positioner()}
            side={side}
            align="center"
            // Over its own row, its inset past it on the side it grows from, so its header lands
            // on the row it came from. Centred on the row, it is centred on the menu.
            sideOffset={({ anchor }) => -(anchor.height + inset)}
            collisionPadding={COLLISION_PADDING}
            collisionAvoidance={{ side: "none", align: "shift" }}>
            <Menu.Popup
              ref={popup}
              data-slot="expandable-menu-submenu"
              data-keyboard={keyboardMark(origin)}
              className={styles.sub()}>
              {/* The row it came from, now the header; pressing it folds the options away. */}
              <div
                aria-hidden
                className={styles.subHeader()}
                onClick={(event) => setOpen(false, originOf(event.nativeEvent))}>
                {rowContent}
                <CaretDown className="text-muted-foreground" />
              </div>
              <div data-slot="expandable-menu-submenu-body" className={styles.subBody()}>
                {children}
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.SubmenuRoot>
    </CommitContext>
  );
}

/**
 * A submenu's options. Choosing one, the current one included, calls `onValueChange`, and then,
 * unless it cancelled the change, closes the submenu, so whatever the value sets lands before
 * anything the close does.
 *
 * @param props - Base UI `Menu.RadioGroup` props.
 * @returns The group.
 */
function RadioGroup({ onValueChange, ...props }: ComponentProps<typeof Menu.RadioGroup>): ReactElement {
  const commit = use(CommitContext);
  return (
    <Menu.RadioGroup
      {...props}
      onValueChange={(value, details) => {
        onValueChange?.(value, details);
        if (!details.isCanceled) commit?.(details);
      }}
    />
  );
}

type RadioItemProps = Omit<ComponentProps<typeof Menu.RadioItem>, "value"> & {
  /** The option's value, which `onHighlight` reports. */
  value: string;
};

/**
 * One option. Choosing it sets the value through its group, which commits the submenu; the menu
 * stays open.
 *
 * @param props - Base UI `Menu.RadioItem` props with a string value.
 * @returns The option.
 */
function RadioItem({ children, className, value, ...props }: RadioItemProps): ReactElement {
  return (
    <Menu.RadioItem
      closeOnClick={false}
      data-slot="expandable-menu-radio-item"
      data-value={value}
      value={value}
      className={mergeClassName(className, styles.row())}
      {...props}>
      {children}
      <Menu.RadioItemIndicator className={styles.indicator()}>
        <Check aria-hidden className="text-foreground" />
      </Menu.RadioItemIndicator>
    </Menu.RadioItem>
  );
}

/**
 * A boolean, drawn as a small switch; it toggles in place and keeps the menu open.
 *
 * @param props - Base UI `Menu.CheckboxItem` props.
 * @returns The item.
 */
function CheckboxItem({
  children,
  className,
  ...props
}: ComponentProps<typeof Menu.CheckboxItem>): ReactElement {
  return (
    <Menu.CheckboxItem
      closeOnClick={false}
      data-slot="expandable-menu-checkbox-item"
      className={mergeClassName(className, styles.row({ className: "group/check" }))}
      {...props}>
      <span className={styles.rowLabel()}>{children}</span>
      <span aria-hidden className={styles.switchTrack()}>
        <span data-slot="expandable-menu-switch-thumb" className={styles.switchThumb()} />
      </span>
    </Menu.CheckboxItem>
  );
}

/**
 * An action that keeps the menu open, such as Copy.
 *
 * @param props - Base UI `Menu.Item` props.
 * @returns The item.
 */
function Item({ className, ...props }: ComponentProps<typeof Menu.Item>): ReactElement {
  return (
    <Menu.Item
      closeOnClick={false}
      data-slot="expandable-menu-item"
      className={mergeClassName(className, styles.row())}
      {...props}
    />
  );
}

/**
 * A group's label, such as the part a group of rows sets.
 *
 * @param props - Base UI `Menu.GroupLabel` props.
 * @returns The label.
 */
function GroupLabel({ className, ...props }: ComponentProps<typeof Menu.GroupLabel>): ReactElement {
  return (
    <Menu.GroupLabel
      data-slot="expandable-menu-group-label"
      className={mergeClassName(className, styles.groupLabel())}
      {...props}
    />
  );
}

/**
 * A rule between rows.
 *
 * @returns The separator.
 */
function Separator(): ReactElement {
  return <Menu.Separator data-slot="expandable-menu-separator" className={styles.separator()} />;
}

/**
 * A Base UI Menu whose round ghost trigger grows into the menu, with in-place submenus that commit a
 * value and keep the menu open. `Group` is Base UI's own part.
 */
export const ExpandableMenu = {
  Root,
  Trigger,
  Popup,
  Submenu,
  RadioGroup,
  RadioItem,
  CheckboxItem,
  Item,
  Group: Menu.Group,
  GroupLabel,
  Separator,
};
