"use client";

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Popover } from "@elmeragroup/fuse/popover";
import type { PopoverContentProps } from "@elmeragroup/fuse/popover";
import { Select } from "@elmeragroup/fuse/select";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { STUDIO_SLOT_TOKENS } from "../../../generated/studio-slot-tokens";
import { isTypingTarget } from "../../../lib/typing-target";
import type { ArtboardSpec } from "../../lib/documents";
import { DENSITY_LABELS } from "../../lib/labels";
import { partTokens } from "../../lib/slot-tokens";
import { STUDIO_TOKEN_NAMES } from "../../lib/tokens";
import { toolbarAnchor } from "../../lib/viewport";
import type { Rect } from "../../lib/viewport";
import {
  BRAND_NAMES,
  BrandOptions,
  DensityToggle,
  SchemeToggle,
  SegmentToggle,
  VariantToggle,
  useArtboardTheme,
} from "../artboard-theme-controls";
import { ChromeScope } from "../chrome-scope";
import { useDesktop } from "../studio-desktop";
import { usePartSelection } from "../studio-part-selection";
import type { PickedPart } from "../studio-part-selection";
import { regionProps } from "../studio-regions";
import { OVERLAYS } from "../studio-shortcuts";
import { useStudio } from "../studio-state";
import { useViewportCommands, useViewportState } from "../studio-viewport";
import { DensityKnobs, ThemeMenu, TokenMenus } from "./theme-menus";
import type { OpenMenu } from "./theme-menus";

const themeToolbar = tv({
  slots: {
    // The chrome scope the toolbar and its menus portal into. It has no box: the popups it holds
    // are placed against the canvas's corner, and the canvas clips them. It hides, menus and all,
    // while the toolbar's anchor is out of the canvas.
    layer: "absolute top-0 left-0 z-30 data-[hidden=true]:invisible",
    // Placement only: the toolbar paints the surface, so the popup drops the popover's own.
    popup: "w-auto gap-0 rounded-lg bg-transparent p-0 shadow-none ring-0",
    // As wide as its controls, up to the room inside the canvas, past which its groups wrap. Its
    // width is its own: the layer that holds it has none to fit into.
    bar: "shadow-lg w-max max-w-(--toolbar-max-width) flex-wrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    group: "flex-wrap",
    label: "flex min-w-0 items-baseline gap-1.5 px-2",
    slot: "text-xs font-mono",
    note: "text-xs text-muted-foreground",
  },
});

const styles = themeToolbar();

/** Screen px between an artboard and its toolbar, clear of the artboard's name label above it. */
const ARTBOARD_OFFSET = 36;

/** Screen px between a picked part and its toolbar. */
const PART_OFFSET = 8;

/** Base UI's default collision padding: the screen px it keeps a popup inside the canvas. */
const COLLISION_PADDING = 5;

/**
 * Screen px a toolbar pinned to the canvas's top keeps from it: more than Base UI's collision
 * padding, so the top side still fits there.
 */
const PINNED_MARGIN = 8;

/** The screen px a toolbar `height` tall needs between the canvas's top and its anchor's top. */
function roomAbove(height: number, sideOffset: number): number {
  return height + sideOffset + PINNED_MARGIN;
}

/** What the toolbar edits: the selected artboard, or the part picked in it. */
type ToolbarTarget =
  | { readonly kind: "artboard"; readonly artboard: ArtboardSpec; readonly element: HTMLElement }
  | { readonly kind: "part"; readonly artboard: ArtboardSpec; readonly part: PickedPart };

type Anchor = PopoverContentProps["anchor"];

/**
 * The element the toolbar sits on, as a new virtual element after every camera move. Its box is
 * the element's, passed through `fit`.
 *
 * Base UI follows an anchor element with an IntersectionObserver whose threshold is the element's
 * last box. It sees an element that moves on screen frame by frame, such as through a glide, and
 * its ResizeObserver sees one that resizes in layout. It misses a step that leaves the element
 * inside its last box: a wheel zoom out around a point inside the anchor shrinks it within the box,
 * and the toolbar would stay behind. Each camera move renders here, as `PartOutline` follows the
 * camera, and hands the positioner a new anchor, which it places the popup against afresh. Its
 * context element keeps Base UI's own tracking and the canvas clipping it.
 */
function useTrackedAnchor(element: HTMLElement | undefined, fit: (box: DOMRect) => Rect): Anchor {
  // Read for its updates only: each camera move renders, and each render makes a new anchor.
  useViewportState();
  return element === undefined
    ? undefined
    : {
        contextElement: element,
        getBoundingClientRect: () => DOMRect.fromRect(fit(element.getBoundingClientRect())),
      };
}

/**
 * Whether Base UI reports the anchor of `popup` clipped out of view. It marks the popup's
 * positioner, the popup's parent, with `data-anchor-hidden`.
 */
function useAnchorHidden(popup: HTMLElement | null): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const positioner = popup?.parentElement;
      if (positioner === null || positioner === undefined) {
        return () => undefined;
      }
      const observer = new MutationObserver(onChange);
      observer.observe(positioner, { attributes: true, attributeFilter: ["data-anchor-hidden"] });
      return () => {
        observer.disconnect();
      };
    },
    [popup]
  );
  return useSyncExternalStore(
    subscribe,
    () => popup?.parentElement?.hasAttribute("data-anchor-hidden") === true,
    () => false
  );
}

/** The Brand list's title among the toolbar's menus. */
const BRAND_MENU = "Brand";

/**
 * The selected artboard's settings, as the inspector's Artboard section sets them: its theme by
 * identity, brand, variant and segment, then its scheme and density. The Brand Select joins the
 * toolbar's arrow-key order through a `Toolbar.Button` that renders its trigger, and opens as one
 * of the toolbar's menus in `menu`, so it closes when another menu opens or the toolbar's anchor
 * hides.
 */
function ArtboardSettings({ artboard, menu }: { artboard: ArtboardSpec; menu: OpenMenu }): ReactElement {
  const { theme, change } = useArtboardTheme(artboard);
  return (
    <>
      <Select.Root
        items={BRAND_NAMES}
        value={theme.brand}
        open={menu.title === BRAND_MENU}
        onOpenChange={(next) => {
          menu.change(BRAND_MENU, next);
        }}
        onValueChange={(brand) => {
          if (brand !== null) {
            change({ brand });
          }
        }}>
        <Toolbar.Button render={<Select.Trigger size="sm" aria-label="Brand" />}>
          <Select.Value />
        </Toolbar.Button>
        {/* Laid over its trigger, as a Select opens by default, the list would run past the
            canvas's top, where the toolbar often sits, and out of reach. It opens below the bar. */}
        <Select.Content alignItemWithTrigger={false}>
          <BrandOptions />
        </Select.Content>
      </Select.Root>
      <VariantToggle artboard={artboard} />
      <SegmentToggle artboard={artboard} />
      <SchemeToggle artboard={artboard} />
      <DensityToggle artboard={artboard} />
    </>
  );
}

/**
 * The bar itself: the artboard's settings, or the picked part's slot and component, then the
 * menus that have tokens for the target. One Toolbar.Root serves both targets and keys its parts,
 * so dropping a part keeps the focused menu button in place. Where the canvas is narrower than the
 * bar, its groups wrap onto a second row; the arrow keys keep their order.
 */
const ThemeBar = memo(function ThemeBar({
  target,
  menu,
}: {
  target: ToolbarTarget;
  menu: OpenMenu;
}): ReactElement {
  const { settingsOf } = useStudio();
  const read = target.kind === "part" ? partTokens(STUDIO_SLOT_TOKENS, target.part.slot) : undefined;
  const names = target.kind === "part" ? (read?.tokens ?? []) : STUDIO_TOKEN_NAMES;
  const { density } = settingsOf(target.artboard);
  return (
    <Toolbar.Root
      aria-label={target.kind === "part" ? "Part theme" : "Artboard theme"}
      className={styles.bar()}
      {...regionProps}>
      {target.kind === "part" ? (
        <span key="part" className={styles.label()}>
          <span className={styles.slot()}>{target.part.slot}</span>
          <span className={styles.note()}>{read?.component ?? "Not a documented component"}</span>
        </span>
      ) : (
        <Toolbar.Group key="artboard" aria-label="Artboard settings" className={styles.group()}>
          <ArtboardSettings artboard={target.artboard} menu={menu} />
        </Toolbar.Group>
      )}
      {names.length === 0 ? (
        <span key="none" className={styles.note()}>
          No role tokens
        </span>
      ) : (
        <Fragment key="menus">
          <Toolbar.Separator />
          <Toolbar.Group aria-label="Theme menus" className={styles.group()}>
            <TokenMenus
              artboard={target.artboard}
              names={names}
              counted={target.kind === "part"}
              menu={menu}
            />
            {target.kind === "part" ? null : (
              <ThemeMenu
                title="Density"
                menu={menu}
                description={`Edits apply to every ${DENSITY_LABELS[density].toLowerCase()} artboard.`}>
                <DensityKnobs density={density} />
              </ThemeMenu>
            )}
          </Toolbar.Group>
        </Fragment>
      )}
    </Toolbar.Root>
  );
});

/**
 * The theme toolbar over the selected artboard, or over the part picked in it: a Popover with no
 * trigger, anchored above its target and portalled into its own chrome layer in the canvas, so it
 * wears the chrome's theme. It edits theme tokens, as the inspector does, through the same edit
 * session. While its anchor is out of the canvas, the layer hides with every menu in it.
 *
 * The selection decides whether it shows, so no dismissal closes it on its own. Escape inside it,
 * once a menu inside it has closed, reaches the canvas, which steps back; the bar only hands focus
 * to the canvas when that step back is about to close it. Opening moves no focus.
 */
function FloatingToolbar(): ReactElement {
  const { artboards, selectedId, toolbarShown } = useStudio();
  const { part } = usePartSelection();
  const { artboardElement, canvas, answerFrame, attachPinnedBar } = useViewportCommands();
  const { frameRequest } = useViewportState();
  const artboard = artboards.find((each) => each.id === selectedId);
  const board = artboard === undefined ? undefined : artboardElement(artboard.id);
  const target = useMemo((): ToolbarTarget | undefined => {
    if (artboard === undefined) {
      return undefined;
    }
    if (part !== undefined) {
      return { kind: "part", artboard, part };
    }
    return board === undefined ? undefined : { kind: "artboard", artboard, element: board };
  }, [artboard, board, part]);
  // The last target stays on screen while the toolbar closes.
  const [shown, setShown] = useState(target);
  if (target !== undefined && target !== shown) {
    setShown(target);
  }
  const current = target ?? shown;
  const element = current?.kind === "part" ? current.part.element : current?.element;
  const sideOffset = current?.kind === "part" ? PART_OFFSET : ARTBOARD_OFFSET;
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);
  // Base UI flips a popup that does not fit on its side, which would drop the toolbar beneath an
  // artboard taller than the canvas, out of view. Lowering the anchor's top instead pins the
  // toolbar to the canvas's top while the anchor runs on below it.
  const anchor = useTrackedAnchor(element, (box) => {
    const frame = canvas()?.getBoundingClientRect();
    const room = roomAbove(popup?.offsetHeight ?? 0, sideOffset);
    return frame === undefined ? box : toolbarAnchor(box, frame, room);
  });
  const layer = useRef<HTMLDivElement>(null);
  // The bar's width cap: the canvas's width less the collision padding on each side, the room
  // Base UI keeps the bar in. The studio sets it rather than read Base UI's `--available-width`,
  // which holds a 100vw placeholder until Base UI has placed the bar, so the bar lays out at its
  // final width, on one row or two, from its first paint, and its first reported height is its
  // real one. A passive effect, as the canvas attaches after its children's layout effects; no
  // bar opens before it runs.
  useEffect(() => {
    const frame = canvas();
    const scope = layer.current;
    if (frame === null || scope === null) {
      return undefined;
    }
    const cap = () => {
      scope.style.setProperty(
        "--toolbar-max-width",
        `${String(frame.clientWidth - 2 * COLLISION_PADDING)}px`
      );
    };
    cap();
    const observer = new ResizeObserver(cap);
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, [canvas]);
  const anchorHidden = useAnchorHidden(popup);
  const open = toolbarShown && target !== undefined && anchor !== undefined;
  // The bar answers the latest frame of an artboard (`zoomToArtboard`) whenever the bar or its
  // target changes: the room the artboard's bar needs above it when the bar shows over that
  // artboard, once Base UI has mounted its popup, and otherwise that it shows none there, hidden,
  // on a part or on another artboard. The viewport acts only on the first answer to a serial.
  const barOver = open && target.kind === "artboard" ? target.artboard.id : undefined;
  useEffect(() => {
    if (frameRequest === undefined) {
      return;
    }
    const showing = barOver === frameRequest.artboardId;
    if (showing && popup === null) {
      return;
    }
    answerFrame(
      showing && popup !== null
        ? {
            serial: frameRequest.serial,
            kind: "measured",
            px: roomAbove(popup.offsetHeight, ARTBOARD_OFFSET),
          }
        : { serial: frameRequest.serial, kind: "not-showing" }
    );
  }, [frameRequest, barOver, popup, answerFrame]);
  // The focus reveal reads the bar between renders, so a control it pans into view clears the bar
  // while the bar is pinned to the canvas's top. A bar floating over its anchor moves with the
  // camera, so it covers nothing a pan could clear.
  const pinned = useRef({ open, anchorHidden, popup });
  useLayoutEffect(() => {
    pinned.current = { open, anchorHidden, popup };
  }, [open, anchorHidden, popup]);
  useEffect(() => {
    attachPinnedBar(() => {
      const bar = pinned.current;
      const frame = canvas();
      if (!bar.open || bar.anchorHidden || bar.popup === null || frame === null) {
        return undefined;
      }
      // The bar's layer scrolls with the canvas, so it is measured where it draws once the
      // canvas's native focus scroll is undone, as the reveal measures the control.
      const box = bar.popup.getBoundingClientRect();
      const top = box.top - frame.getBoundingClientRect().top + frame.scrollTop;
      return top <= PINNED_MARGIN + 1 ? top + box.height : undefined;
    });
    return () => {
      attachPinnedBar(null);
    };
  }, [attachPinnedBar, canvas]);
  // The open menu, and the target the toolbar showed when it opened.
  const [openMenu, setOpenMenu] = useState<
    { readonly target: ToolbarTarget | undefined; readonly title: string } | undefined
  >(undefined);
  const changeMenu = useCallback(
    (title: string, next: boolean) => {
      setOpenMenu((current) => {
        if (next) {
          return { target, title };
        }
        return current?.title === title ? undefined : current;
      });
    },
    [target]
  );
  const menu = useMemo(
    (): OpenMenu => ({ title: openMenu?.title, change: changeMenu }),
    [openMenu, changeMenu]
  );
  // A menu closes with the toolbar, when its target changes, so a new target opens with no menu
  // open, and while its anchor is out of the canvas, so no hidden menu holds focus or takes the
  // next Escape.
  if (openMenu !== undefined && (!open || anchorHidden || openMenu.target !== target)) {
    setOpenMenu(undefined);
  }
  // An invisible toolbar keeps no focus: it moves to the canvas.
  useEffect(() => {
    if (anchorHidden && layer.current?.contains(document.activeElement) === true) {
      canvas()?.focus();
    }
  }, [anchorHidden, canvas]);

  return (
    <ChromeScope ref={layer} className={styles.layer()} data-canvas-overlay data-hidden={anchorHidden}>
      <Popover.Root
        open={open}
        onOpenChange={(next, details) => {
          details.cancel();
          if (next || details.reason !== "escape-key") {
            return;
          }
          // The canvas takes the step back; the bar only hands focus to the canvas when the step
          // back is about to close it.
          const pressed = details.event.target;
          if (
            pressed instanceof Node &&
            popup?.contains(pressed) === true &&
            part === undefined &&
            !isTypingTarget(pressed, OVERLAYS)
          ) {
            canvas()?.focus();
          }
          details.allowPropagation();
        }}>
        <Popover.Content
          ref={setPopup}
          anchor={anchor}
          side="top"
          sideOffset={sideOffset}
          initialFocus={false}
          // A group of the canvas chrome, not a dialog: it takes no focus, and the studio's keys
          // stay the studio's inside it, as on the toolbar at the canvas's foot.
          role="group"
          aria-label="Theme toolbar"
          className={styles.popup()}>
          {current === undefined ? null : <ThemeBar target={current} menu={menu} />}
        </Popover.Content>
      </Popover.Root>
    </ChromeScope>
  );
}

/**
 * The floating theme toolbar, on a desktop only: below `lg` the inspector's Sheet stands in. It
 * renders its own chrome layer in the canvas, a theme scope its popovers portal into.
 */
export const ThemeToolbar = memo(function ThemeToolbar(): ReactElement | null {
  return useDesktop() ? <FloatingToolbar /> : null;
});
