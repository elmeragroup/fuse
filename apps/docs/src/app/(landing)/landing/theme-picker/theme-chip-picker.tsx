"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { BRANDS } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { Kbd } from "../app-shell/kbd";
import { BrandMark } from "../brand-mark";
import { isTypingTarget } from "../typing-target";
import { SchemeGlyph, SchemeIcon } from "./scheme-icon";
import { useIsPhone, useThemePicker } from "./use-theme-picker";
import type { AxisOption } from "./use-theme-picker";

const themeChipPicker = tv({
  slots: {
    // The chip's face: the brand's mark, the summary, and the scheme. Below `lg` the nav's menu
    // leaves room for the brand alone, and the chip shrinks and truncates before the bar overflows.
    chip: "landing-press max-w-72 min-w-0 shrink gap-2",
    chipMark: "h-4",
    chipText: "min-w-0 truncate",
    chipWide: "hidden lg:inline",
    chipNarrow: "lg:hidden",
    // Below `sm` the brand's name needs the glyph's room; the Sheet shows the scheme.
    chipScheme: "sm:inline-flex hidden text-muted-foreground",
    tooltipKeys: "ml-2",
    popover: "w-84 gap-5",
    popoverTitle: "sr-only",
    sheetBody: "pb-footer-end space-y-5",
    panel: "flex flex-col gap-5",
    row: "flex flex-col gap-2",
    rowLabel: "text-xs font-medium m-0 text-muted-foreground",
    // Brand tiles: the mark over the name, three to a row.
    // `items-stretch` beats the group's `items-center`, so a two-line name never shortens its
    // neighbours.
    tiles: "grid w-full grid-cols-3 items-stretch gap-2",
    tile: "text-xs h-auto min-h-16 flex-col gap-2 px-1 py-3 whitespace-normal data-pressed:border-foreground data-pressed:bg-foreground/12",
    tileMark: "h-5",
  },
});

const styles = themeChipPicker();

// A row fills the panel's width, and each option takes an equal share of it.
const axisToggle = tv({
  slots: {
    group: "w-full",
    // Fuse's outline toggle marks the pressed option with `muted`, which sits one step off a
    // dark popover; the picker's options carry a foreground tint that reads in either scheme.
    item: "flex-1 gap-1.5 aria-disabled:bg-transparent data-pressed:bg-foreground/12 data-pressed:text-foreground",
  },
});

const axisStyles = axisToggle();

type AxisToggleProps<Value extends string> = {
  /** The id of the panel row's visible label, which names the group. */
  labelledBy: string;
  options: readonly AxisOption<Value>[];
  value: Value;
  onChange: (next: Value) => void;
  /** The glyph each option shows beside its label, if any. */
  icon?: (value: Value) => ReactNode;
};

/**
 * One axis as a segmented toggle row where exactly one option is on. An option the current brand
 * cannot take is disabled, and names its reason twice: as the button's description, which a
 * screen reader reads, and in a tooltip on hover or focus.
 */
function AxisToggle<Value extends string>({
  labelledBy,
  options,
  value,
  onChange,
  icon,
}: AxisToggleProps<Value>): ReactElement {
  return (
    <ToggleGroup.Root
      aria-labelledby={labelledBy}
      variant="outline"
      size="sm"
      spacing={0}
      className={axisStyles.group()}
      value={[value]}
      onValueChange={(next) => {
        const picked = options.find((option) => option.value === next[0]);
        if (picked !== undefined && picked.blocked === undefined) {
          onChange(picked.value);
        }
      }}>
      {options.map((option) => (
        <AxisItem key={option.value} option={option} glyph={icon?.(option.value)} />
      ))}
    </ToggleGroup.Root>
  );
}

type AxisItemProps<Value extends string> = {
  option: AxisOption<Value>;
  glyph: ReactNode;
};

function AxisItem<Value extends string>({ option, glyph }: AxisItemProps<Value>): ReactElement {
  const reasonId = useId();
  const { value, label, blocked } = option;
  const face = (
    <>
      {glyph}
      {label}
    </>
  );
  if (blocked === undefined) {
    return (
      <ToggleGroup.Item value={value} className={axisStyles.item()}>
        {face}
      </ToggleGroup.Item>
    );
  }
  // A blocked option stays focusable, so a keyboard reaches it and hears why, and a pointer's
  // hover opens its tooltip; a native `disabled` would drop both. The group ignores its press.
  return (
    <>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <ToggleGroup.Item
              value={value}
              aria-disabled
              aria-describedby={reasonId}
              className={axisStyles.item()}
            />
          }>
          {face}
        </Tooltip.Trigger>
        <Tooltip.Content>{blocked}</Tooltip.Content>
      </Tooltip.Root>
      <span id={reasonId} hidden>
        {blocked}
      </span>
    </>
  );
}

/** The scheme row: sun, moon and monitor beside their names. */
function SchemeToggle({ labelledBy }: { labelledBy: string }): ReactElement {
  const { colorScheme, schemes, changeColorScheme } = useThemePicker();
  return (
    <AxisToggle<ColorScheme>
      labelledBy={labelledBy}
      options={schemes}
      value={colorScheme}
      onChange={changeColorScheme}
      icon={(scheme) => <SchemeGlyph scheme={scheme} />}
    />
  );
}

/** The segment row, with the segments the current brand does not serve disabled. */
function SegmentToggle({ labelledBy }: { labelledBy: string }): ReactElement {
  const { theme, segments, changeTheme } = useThemePicker();
  return (
    <AxisToggle
      labelledBy={labelledBy}
      options={segments}
      value={theme.segment}
      onChange={(segment) => {
        changeTheme({ segment });
      }}
    />
  );
}

/** The variant row; the hero window's Internal/External switch moves the same value. */
function VariantToggle({ labelledBy }: { labelledBy: string }): ReactElement {
  const { theme, variants, changeTheme } = useThemePicker();
  return (
    <AxisToggle
      labelledBy={labelledBy}
      options={variants}
      value={theme.variant}
      onChange={(variant) => {
        changeTheme({ variant });
      }}
    />
  );
}

/** Every brand as a tile: its mark over its name, three to a row. */
function BrandTiles({
  labelledBy,
  currentTile,
}: {
  labelledBy: string;
  currentTile: RefObject<HTMLButtonElement | null>;
}): ReactElement {
  const { theme, brands, changeTheme } = useThemePicker();
  return (
    <ToggleGroup.Root
      aria-labelledby={labelledBy}
      variant="outline"
      className={styles.tiles()}
      value={[theme.brand]}
      onValueChange={(next) => {
        const brand = brands.find((option) => option.value === next[0]);
        if (brand !== undefined) {
          changeTheme({ brand: brand.value });
        }
      }}>
      {brands.map((brand) => (
        <ToggleGroup.Item
          key={brand.value}
          value={brand.value}
          className={styles.tile()}
          ref={brand.value === theme.brand ? currentTile : null}>
          <BrandMark brand={brand.value} size="icon" className={styles.tileMark()} />
          {brand.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** A labelled row of the panel: the visible label names the control under it. */
function PanelRow({
  label,
  children,
}: {
  label: string;
  children: (labelId: string) => ReactNode;
}): ReactElement {
  const labelId = useId();
  return (
    <div className={styles.row()}>
      <p id={labelId} className={styles.rowLabel()}>
        {label}
      </p>
      {children(labelId)}
    </div>
  );
}

/**
 * All four axes as labelled rows: brand tiles, segment, variant and scheme. `currentTile` holds the
 * current brand's tile, where the shortcut puts focus.
 */
function ThemePanel({ currentTile }: { currentTile: RefObject<HTMLButtonElement | null> }): ReactElement {
  return (
    <div className={styles.panel()}>
      <PanelRow label="Brand">{(id) => <BrandTiles labelledBy={id} currentTile={currentTile} />}</PanelRow>
      <PanelRow label="Segment">{(id) => <SegmentToggle labelledBy={id} />}</PanelRow>
      <PanelRow label="Variant">{(id) => <VariantToggle labelledBy={id} />}</PanelRow>
      <PanelRow label="Colour scheme">{(id) => <SchemeToggle labelledBy={id} />}</PanelRow>
    </div>
  );
}

/** ⌘J or Ctrl+J on any platform, the pair `aria-keyshortcuts` names. */
function isShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j"
  );
}

function subscribeNever(): () => void {
  return () => undefined;
}

/**
 * The modifier key the tooltip names: ⌘ on Apple platforms, Ctrl elsewhere. The tooltip renders
 * only on the client, so the server's answer never reaches the markup.
 */
function useShortcutModifier(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad/u.test(navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "⌘"
  );
}

/** How the picker last opened: from the chip, or from the shortcut with focus somewhere else. */
type Opening = { readonly by: "chip" } | { readonly by: "shortcut"; readonly returnTo: HTMLElement | null };

/** True when `element` can still take focus: in the document, outside any inert subtree, enabled and rendered. */
function canTakeFocus(element: HTMLElement | null): element is HTMLElement {
  return (
    element?.isConnected === true &&
    element.closest("[inert]") === null &&
    !element.matches(":disabled") &&
    element.checkVisibility()
  );
}

/**
 * The nav chip that sums up the theme and opens the panel: a popover that stays open while the
 * visitor explores, or a bottom Sheet on a phone. The chip's name starts with "Theme" and carries
 * the summary it shows.
 *
 * ⌘J or Ctrl+J opens it from anywhere outside a text field, with focus on the current brand's
 * tile, and a second press closes it. Closing hands focus back to where the shortcut found it, or
 * to the chip when that element went inert or left the page.
 * The Dashboard's own shortcuts fire only with focus inside its window, so ⌘J clashes with none.
 */
export function ThemeChipPicker(): ReactElement {
  const { theme, colorScheme, summary } = useThemePicker();
  const phone = useIsPhone();
  const modifier = useShortcutModifier();
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState<Opening>({ by: "chip" });
  const currentTile = useRef<HTMLButtonElement>(null);
  const chipButton = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);

  const changeOpen = (next: boolean) => {
    if (next) {
      setOpening({ by: "chip" });
    }
    setOpen(next);
  };
  const onShortcut = useEffectEvent(() => {
    if (!open) {
      const focused = document.activeElement;
      setOpening({ by: "shortcut", returnTo: focused instanceof HTMLElement ? focused : null });
    }
    setOpen(!open);
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isShortcut(event) && !event.repeat && !isTypingTarget(event.target)) {
        // Ctrl+J opens the browser's downloads on Windows and Linux.
        event.preventDefault();
        onShortcut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // The chip opens and closes with the popup's own focus rules, which leave focus where an outside
  // press put it. The shortcut lands on the current brand and hands focus back to where it found
  // it, or to the chip when a pick made that element inert or replaced it.
  const shortcutReturn = (returnTo: HTMLElement | null) => (): HTMLElement | boolean => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body && !popup.current?.contains(focused)) {
      return false;
    }
    return canTakeFocus(returnTo) ? returnTo : (chipButton.current ?? true);
  };
  const initialFocus = opening.by === "shortcut" ? currentTile : true;
  const finalFocus = opening.by === "shortcut" ? shortcutReturn(opening.returnTo) : true;

  const chip = (
    <Button
      ref={chipButton}
      variant="outline"
      size="sm"
      aria-label={`Theme: ${summary}`}
      aria-keyshortcuts="Meta+J Control+J"
      className={styles.chip()}
    />
  );
  const face = (
    <>
      <BrandMark brand={theme.brand} size="icon" className={styles.chipMark()} />
      <span className={styles.chipText()}>
        <span className={styles.chipWide()}>{summary}</span>
        <span className={styles.chipNarrow()}>{BRANDS[theme.brand].displayName}</span>
      </span>
      <span className={styles.chipScheme()}>
        <SchemeIcon scheme={colorScheme} />
      </span>
    </>
  );
  // The hint stays out of the way while the panel it names is open.
  const tooltip = (trigger: ReactElement) => (
    <Tooltip.Root disabled={open}>
      <Tooltip.Trigger render={trigger}>{face}</Tooltip.Trigger>
      <Tooltip.Content>
        Theme
        <span className={styles.tooltipKeys()}>
          <Kbd keys={[modifier, "J"]} />
        </span>
      </Tooltip.Content>
    </Tooltip.Root>
  );

  if (phone) {
    return (
      <Sheet.Root side="bottom" open={open} onOpenChange={changeOpen}>
        {tooltip(<Sheet.Trigger render={chip} />)}
        <Sheet.Content ref={popup} initialFocus={initialFocus} finalFocus={finalFocus}>
          <Sheet.Header>
            <Sheet.Title>Theme</Sheet.Title>
          </Sheet.Header>
          <Sheet.Body className={styles.sheetBody()}>
            <ThemePanel currentTile={currentTile} />
          </Sheet.Body>
        </Sheet.Content>
      </Sheet.Root>
    );
  }
  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      {tooltip(<Popover.Trigger render={chip} />)}
      <Popover.Content
        ref={popup}
        align="end"
        initialFocus={initialFocus}
        finalFocus={finalFocus}
        className={styles.popover()}>
        <Popover.Title className={styles.popoverTitle()}>Theme</Popover.Title>
        <ThemePanel currentTile={currentTile} />
      </Popover.Content>
    </Popover.Root>
  );
}
