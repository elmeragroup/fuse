"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { CaretDown } from "@elmeragroup/fuse/icons";
import { BRAND_CODES, BRANDS, THEME_SEGMENTS, THEME_VARIANTS, coerceTheme } from "@elmeragroup/fuse/theme";
import type { ThemeInput, ThemeSegment } from "@elmeragroup/fuse/theme";

import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import { useStudio } from "./studio-state";

const studioThemePicker = tv({
  slots: {
    trigger: "sm:max-w-48 max-w-36 min-w-0",
    summary: "truncate",
    content: "w-60",
    help: "text-xs px-3 pt-1 pb-2 leading-4.5 text-muted-foreground",
  },
});

const styles = studioThemePicker();

/** The theme an axis change lands on: a brand pinned to one segment drags the segment along. */
function change(theme: ThemeInput, axis: Partial<ThemeInput>): ThemeInput | null {
  return coerceTheme({ ...theme, ...axis });
}

/**
 * The base theme every artboard renders in: variant, brand and segment, through Fuse's
 * `coerceTheme`, so only a legal theme is ever picked.
 */
export function StudioThemePicker(): ReactElement {
  const { theme, setTheme } = useStudio();
  const segments: readonly ThemeSegment[] = BRANDS[theme.brand].segments;
  const commit = (axis: Partial<ThemeInput>) => {
    const next = change(theme, axis);
    if (next !== null) {
      setTheme(next);
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline" size="sm" className={styles.trigger()} />}>
        <span className="sr-only">Base theme: </span>
        <span className={styles.summary()}>
          {`${BRANDS[theme.brand].displayName} · ${VARIANT_LABELS[theme.variant]} · ${SEGMENT_LABELS[theme.segment]}`}
        </span>
        <CaretDown data-icon="inline-end" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className={styles.content()}>
        <DropdownMenu.RadioGroup
          value={theme.brand}
          onValueChange={(brand) => {
            commit({ brand });
          }}>
          <DropdownMenu.Label>Brand</DropdownMenu.Label>
          {BRAND_CODES.map((brand) => (
            <DropdownMenu.RadioItem key={brand} value={brand} closeOnClick={false}>
              {BRANDS[brand].displayName}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.RadioGroup
          value={theme.variant}
          onValueChange={(variant) => {
            commit({ variant });
          }}>
          <DropdownMenu.Label>Variant</DropdownMenu.Label>
          {THEME_VARIANTS.map((variant) => (
            <DropdownMenu.RadioItem key={variant} value={variant} closeOnClick={false}>
              {VARIANT_LABELS[variant]}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.RadioGroup
          value={theme.segment}
          onValueChange={(segment) => {
            commit({ segment });
          }}>
          <DropdownMenu.Label>Segment</DropdownMenu.Label>
          {THEME_SEGMENTS.map((segment) => (
            <DropdownMenu.RadioItem
              key={segment}
              value={segment}
              closeOnClick={false}
              disabled={!segments.includes(segment)}>
              {SEGMENT_LABELS[segment]}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        {segments.length === 1 ? (
          <p
            className={styles.help()}>{`${BRANDS[theme.brand].displayName} serves ${SEGMENT_LABELS[theme.segment]} only.`}</p>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
