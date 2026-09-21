"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import type { DropdownMenuRadioGroupProps } from "@elmeragroup/fuse/dropdown-menu";
import { ArrowsClockwise, SlidersHorizontal } from "@elmeragroup/fuse/icons";
import { BRANDS, coerceTheme, useColorScheme } from "@elmeragroup/fuse/theme";
import type { ThemeInput, ThemeSegment } from "@elmeragroup/fuse/theme";

import {
  COLOR_SCHEME_LABELS,
  COLOR_SCHEMES,
  DEFAULT_THEME,
  SEGMENT_LABELS,
  THEME_BRANDS,
  THEME_SEGMENTS,
  THEME_VARIANTS,
  VARIANT_LABELS,
} from "../lib/theme";

const themePicker = tv({
  slots: {
    trigger: "shrink-0 data-popup-open:bg-accent",
    icon: "size-4.5",
    content: "w-70 max-w-[calc(100vw-2rem)]",
    section: "flex flex-col gap-1 px-3 pt-3 pb-2.5",
    heading: "text-sm font-semibold",
    description: "text-xs leading-4.5 text-muted-foreground",
    label: "px-3 leading-4.5",
    item: "pl-3",
    separator: "mx-0 my-0",
    segmentHelp: "text-xs px-3 pt-2 pb-2.5 leading-4.5 text-muted-foreground",
    reset: "text-sm gap-2.5 px-3 py-2",
  },
  variants: {
    spacing: {
      tight: {
        section: "pb-1",
      },
    },
  },
});

const styles = themePicker();

type PickerRadioGroupProps<T extends string> = Required<
  Pick<DropdownMenuRadioGroupProps<T>, "value" | "onValueChange">
> & {
  label: string;
  options: readonly T[];
  optionLabel: (option: T) => string;
  isOptionDisabled?: (option: T) => boolean;
};

function PickerRadioGroup<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onValueChange,
  isOptionDisabled,
}: PickerRadioGroupProps<T>): ReactElement {
  return (
    <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
      <DropdownMenu.Label className={styles.label()}>{label}</DropdownMenu.Label>
      {options.map((option) => (
        <DropdownMenu.RadioItem
          key={option}
          value={option}
          disabled={isOptionDisabled?.(option)}
          closeOnClick={false}
          className={styles.item()}>
          {optionLabel(option)}
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  );
}

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
        render={<Button variant="ghost" size="icon-sm" aria-label="Theme settings" />}>
        <SlidersHorizontal className={styles.icon()} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" sideOffset={8} className={styles.content()}>
        <div className={styles.section()}>
          <p className={styles.heading()}>Theme settings</p>
          <p className={styles.description()}>Appearance and component previews</p>
        </div>
        <PickerRadioGroup
          label="Appearance"
          value={colorScheme}
          options={COLOR_SCHEMES}
          optionLabel={(scheme) => COLOR_SCHEME_LABELS[scheme]}
          onValueChange={setColorScheme}
        />
        <DropdownMenu.Separator className={styles.separator()} />
        <div className={styles.section({ spacing: "tight" })}>
          <p className={styles.heading()}>Component previews</p>
          <p className={styles.description()}>Only changes the examples on this page.</p>
        </div>
        <PickerRadioGroup
          label="Variant"
          value={theme.variant}
          options={THEME_VARIANTS}
          optionLabel={(variant) => VARIANT_LABELS[variant]}
          onValueChange={(variant) => commitTheme({ ...theme, variant }, onThemeChange)}
        />
        <DropdownMenu.Separator className={styles.separator()} />
        <PickerRadioGroup
          label="Brand"
          value={theme.brand}
          options={THEME_BRANDS}
          optionLabel={(brand) => BRANDS[brand].displayName}
          onValueChange={(brand) => commitTheme({ ...theme, brand }, onThemeChange)}
        />
        <DropdownMenu.Separator className={styles.separator()} />
        <PickerRadioGroup
          label="Segment"
          value={theme.segment}
          options={THEME_SEGMENTS}
          optionLabel={(segment) => SEGMENT_LABELS[segment]}
          onValueChange={(segment) => commitTheme({ ...theme, segment }, onThemeChange)}
          isOptionDisabled={(segment) => !allowedSegments.includes(segment)}
        />
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
