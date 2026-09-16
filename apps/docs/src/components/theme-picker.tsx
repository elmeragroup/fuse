"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/ui/button";
import { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";
import { ArrowsClockwise, SlidersHorizontal } from "@elmeragroup/ui/icons";
import { BRANDS, coerceTheme, useColorScheme } from "@elmeragroup/ui/theme";
import type { BrandCode, ColorScheme, ThemeInput, ThemeSegment, ThemeVariant } from "@elmeragroup/ui/theme";

import {
  COLOR_SCHEME_LABELS,
  COLOR_SCHEMES,
  DEFAULT_THEME,
  THEME_BRANDS,
  THEME_SEGMENTS,
  THEME_VARIANTS,
} from "../lib/theme";

const themePicker = tv({
  slots: {
    trigger: "shrink-0 data-popup-open:bg-accent",
    icon: "size-4.5",
    content: "w-82 max-w-[calc(100vw-2rem)]",
    introduction: "flex flex-col gap-1 px-3 pt-3 pb-2.5",
    title: "text-sm font-semibold",
    description: "text-xs leading-4.5 text-muted-foreground",
    previewHeading: "flex flex-col gap-1 px-3 pt-3 pb-1",
    previewTitle: "text-sm font-semibold",
    label: "px-3 leading-4.5",
    appearanceLabel: "flex items-center justify-between pr-3",
    hint: "text-xs font-normal text-muted-foreground",
    item: "gap-3 pr-10 pl-3",
    itemLabel: "min-w-0 flex-1",
    brandCode: "text-xs w-9 shrink-0 font-mono text-muted-foreground",
    separator: "mx-0 my-0",
    segmentHelp: "text-xs px-3 pt-2 pb-2.5 leading-4.5 text-muted-foreground",
    reset: "text-sm gap-2.5 px-3 py-2",
  },
});

const styles = themePicker();

const VARIANT_LABELS = { internal: "Internal", external: "External" } as const;
const SEGMENT_LABELS = { private: "Private", company: "Company" } as const;

export type ThemePickerProps = {
  theme: ThemeInput;
  onThemeChange: (theme: ThemeInput) => void;
};

export function ThemePicker({ theme, onThemeChange }: ThemePickerProps): ReactElement {
  const { colorScheme, setColorScheme } = useColorScheme();
  const allowedSegments: readonly ThemeSegment[] = BRANDS[theme.brand].segments;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={styles.trigger()}
        render={<Button variant="outline" size="icon-sm" aria-label="Theme settings" />}>
        <SlidersHorizontal className={styles.icon()} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" sideOffset={8} className={styles.content()}>
        <div className={styles.introduction()}>
          <p className={styles.title()}>Theme settings</p>
          <p className={styles.description()}>Appearance and component previews</p>
        </div>
        <DropdownMenu.RadioGroup
          value={colorScheme}
          onValueChange={(value: ColorScheme) => setColorScheme(value)}>
          <div className={styles.appearanceLabel()}>
            <DropdownMenu.Label className={styles.label()}>Appearance</DropdownMenu.Label>
            <span className={styles.hint()}>Docs &amp; previews</span>
          </div>
          {COLOR_SCHEMES.map((scheme) => (
            <DropdownMenu.RadioItem
              key={scheme}
              value={scheme}
              closeOnClick={false}
              className={styles.item()}>
              <span className={styles.itemLabel()}>{COLOR_SCHEME_LABELS[scheme]}</span>
              {scheme === "system" ? <span className={styles.hint()}>Follow device</span> : null}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator className={styles.separator()} />
        <div className={styles.previewHeading()}>
          <p className={styles.previewTitle()}>Component previews</p>
          <p className={styles.description()}>Only changes the examples on this page.</p>
        </div>
        <DropdownMenu.RadioGroup
          value={theme.variant}
          onValueChange={(variant: ThemeVariant) => commitTheme({ ...theme, variant }, onThemeChange)}>
          <DropdownMenu.Label className={styles.label()}>Variant</DropdownMenu.Label>
          {THEME_VARIANTS.map((variant) => (
            <DropdownMenu.RadioItem
              key={variant}
              value={variant}
              closeOnClick={false}
              className={styles.item()}>
              <span className={styles.itemLabel()}>{VARIANT_LABELS[variant]}</span>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator className={styles.separator()} />
        <DropdownMenu.RadioGroup
          value={theme.brand}
          onValueChange={(brand: BrandCode) => commitTheme({ ...theme, brand }, onThemeChange)}>
          <DropdownMenu.Label className={styles.label()}>Brand</DropdownMenu.Label>
          {THEME_BRANDS.map((brand) => (
            <DropdownMenu.RadioItem key={brand} value={brand} closeOnClick={false} className={styles.item()}>
              <span className={styles.itemLabel()}>{BRANDS[brand].displayName}</span>
              <span className={styles.brandCode()}>{brand}</span>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator className={styles.separator()} />
        <DropdownMenu.RadioGroup
          value={theme.segment}
          onValueChange={(segment: ThemeSegment) => commitTheme({ ...theme, segment }, onThemeChange)}>
          <DropdownMenu.Label className={styles.label()}>Segment</DropdownMenu.Label>
          {THEME_SEGMENTS.map((segment) => (
            <DropdownMenu.RadioItem
              key={segment}
              value={segment}
              disabled={!allowedSegments.includes(segment)}
              closeOnClick={false}
              className={styles.item()}>
              <span className={styles.itemLabel()}>{SEGMENT_LABELS[segment]}</span>
              {allowedSegments.includes(segment) ? null : <span className={styles.hint()}>Unavailable</span>}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        {allowedSegments.length === 1 ? (
          <p className={styles.segmentHelp()}>
            This brand supports {SEGMENT_LABELS[theme.segment]} only.
            <br />
            Selecting it also updates the segment.
          </p>
        ) : null}
        <DropdownMenu.Separator className={styles.separator()} />
        <DropdownMenu.Item
          className={styles.reset()}
          closeOnClick={false}
          onClick={() => onThemeChange(DEFAULT_THEME)}>
          <ArrowsClockwise />
          Reset preview theme
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function commitTheme(
  next: { variant: ThemeInput["variant"]; brand: ThemeInput["brand"]; segment: ThemeSegment },
  onThemeChange: (theme: ThemeInput) => void
): void {
  const coerced = coerceTheme(next);
  if (coerced !== null) {
    onThemeChange(coerced);
  }
}
