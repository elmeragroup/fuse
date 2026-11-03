"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Frame } from "@elmeragroup/fuse/frame";
import { Moon, Sun } from "@elmeragroup/fuse/icons";
import { Select } from "@elmeragroup/fuse/select";
import { Tabs } from "@elmeragroup/fuse/tabs";
import {
  BRAND_CODES,
  BRANDS,
  THEME_SEGMENTS,
  THEME_VARIANTS,
  themeSlug,
  useColorScheme,
} from "@elmeragroup/fuse/theme";
import type { BrandCode, ThemeInput, ThemeSegment, ThemeVariant } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Toolbar } from "@elmeragroup/fuse/toolbar";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { PALETTE_CATALOG } from "../../generated/palette-catalog";
import { paletteTheme, paletteView } from "../../lib/palettes";
import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import { usePreviewTheme } from "../preview-theme";
import { commitTheme } from "../theme-picker";
import { CopyStatus, useCopyFeedback } from "./color-readout";
import { PaletteOverview } from "./palette-overview";
import { PaletteTable } from "./palette-table";

const paletteInspector = tv({
  slots: {
    // The Tabs root renders the Frame root, as the demo frame does, so the header, panel and
    // footer stay the Frame's own items. The Frame is the window: its header is the title bar.
    window: "not-prose shadow-lg my-6 gap-0",
    titleBar: "flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2",
    titleText: "flex min-w-0 flex-col gap-0.5",
    slug: "truncate font-mono",
    body: "flex min-w-0 flex-col gap-4",
    toolbar: "flex-wrap",
    trigger: "min-w-0",
    schemeIcon: "size-4",
    // On a phone the scheme switch wraps to its own line, where a separator would trail the
    // coordinates.
    separator: "max-sm:hidden",
    footer: "text-xs flex-row flex-wrap justify-between gap-x-4 gap-y-1 text-muted-foreground tabular-nums",
    failing: "font-medium text-error",
  },
});

const styles = paletteInspector();

const SCHEME_LABELS = { light: "Light", dark: "Dark" } as const satisfies Record<ResolvedColorScheme, string>;

function isScheme(value: string | undefined): value is ResolvedColorScheme {
  return value === "light" || value === "dark";
}

type Mode = "default" | "detailed";

type ThemeControlsProps = {
  readonly theme: ThemeInput;
  readonly onThemeChange: (theme: ThemeInput) => void;
  readonly scheme: ResolvedColorScheme;
  readonly onSchemeChange: (scheme: ResolvedColorScheme) => void;
};

/**
 * The inspector's toolbar: the three theme coordinates and the color scheme. A brand pinned to
 * one segment disables the other, and picking it moves the segment along, as the header's picker
 * does.
 */
function ThemeControls({ theme, onThemeChange, scheme, onSchemeChange }: ThemeControlsProps): ReactElement {
  const allowedSegments: readonly ThemeSegment[] = BRANDS[theme.brand].segments;
  return (
    <Toolbar.Root aria-label="Theme" className={styles.toolbar()}>
      <Select.Root<ThemeVariant>
        items={VARIANT_LABELS}
        value={theme.variant}
        onValueChange={(variant) => {
          if (variant !== null) commitTheme({ ...theme, variant }, onThemeChange);
        }}>
        <Toolbar.Button
          render={<Select.Trigger size="sm" aria-label="Variant" className={styles.trigger()} />}>
          <Select.Value />
        </Toolbar.Button>
        <Select.Content>
          {THEME_VARIANTS.map((variant) => (
            <Select.Item key={variant} value={variant}>
              {VARIANT_LABELS[variant]}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <Select.Root<BrandCode>
        items={Object.fromEntries(BRAND_CODES.map((brand) => [brand, BRANDS[brand].displayName]))}
        value={theme.brand}
        onValueChange={(brand) => {
          if (brand !== null) commitTheme({ ...theme, brand }, onThemeChange);
        }}>
        <Toolbar.Button render={<Select.Trigger size="sm" aria-label="Brand" className={styles.trigger()} />}>
          <Select.Value />
        </Toolbar.Button>
        <Select.Content>
          {BRAND_CODES.map((brand) => (
            <Select.Item key={brand} value={brand}>
              {BRANDS[brand].displayName}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <Select.Root<ThemeSegment>
        items={SEGMENT_LABELS}
        value={theme.segment}
        onValueChange={(segment) => {
          if (segment !== null) commitTheme({ ...theme, segment }, onThemeChange);
        }}>
        <Toolbar.Button
          render={<Select.Trigger size="sm" aria-label="Segment" className={styles.trigger()} />}>
          <Select.Value />
        </Toolbar.Button>
        <Select.Content>
          {THEME_SEGMENTS.map((segment) => (
            <Select.Item key={segment} value={segment} disabled={!allowedSegments.includes(segment)}>
              {SEGMENT_LABELS[segment]}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <Toolbar.Separator className={styles.separator()} />
      <ToggleGroup.Root
        aria-label="Color scheme"
        size="sm"
        value={[scheme]}
        onValueChange={(value) => {
          const [next] = value;
          if (isScheme(next)) onSchemeChange(next);
        }}>
        <ToggleGroup.Item value="light">
          <Sun aria-hidden className={styles.schemeIcon()} />
          {SCHEME_LABELS.light}
        </ToggleGroup.Item>
        <ToggleGroup.Item value="dark">
          <Moon aria-hidden className={styles.schemeIcon()} />
          {SCHEME_LABELS.dark}
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </Toolbar.Root>
  );
}

/**
 * The palettes page's token inspector: a window built from Fuse parts that shows one theme's
 * color roles in one scheme. Default lists the tones, the roles and the graded pairs densely,
 * with each value in a tooltip; Detailed puts every role's values in a searchable, filterable
 * table.
 *
 * The theme is the header picker's preview theme, so picking a theme here moves the header's
 * picker too. The scheme follows the page's until a scheme is picked here. Swatches paint the
 * generated values directly, so the inspector shows any theme and scheme without re-theming the
 * page around it.
 */
export function PaletteInspector(): ReactElement {
  const { theme, setTheme } = usePreviewTheme();
  const { resolvedColorScheme } = useColorScheme();
  const [pickedScheme, setPickedScheme] = useState<ResolvedColorScheme | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("default");
  const scheme = pickedScheme ?? resolvedColorScheme ?? "light";
  const slug = themeSlug(theme);
  const copy = useCopyFeedback();

  // Every legal theme is in the generated catalog, so a missing one is a stale catalog and throws.
  const view = useMemo(
    () => paletteView(PALETTE_CATALOG, paletteTheme(PALETTE_CATALOG, slug), scheme),
    [slug, scheme]
  );

  const belowAa = view.pairs.filter((pair) => pair.grade === "below-aa").length;

  return (
    <Tooltip.Provider>
      <Tabs.Root
        value={mode}
        onValueChange={(value) => {
          // Base UI types a tab's value as `any`; the two triggers are the only values.
          setMode(value === "detailed" ? "detailed" : "default");
        }}
        className={styles.window()}
        render={<Frame.Root layout="flush" />}
        role="region"
        aria-label="Token inspector"
        data-palette-inspector>
        <Frame.Header className={styles.titleBar()}>
          <div className={styles.titleText()}>
            <Frame.Title>Token inspector</Frame.Title>
            <Frame.Description className={styles.slug()} data-palette-slug>
              {slug} · {SCHEME_LABELS[scheme].toLowerCase()}
            </Frame.Description>
          </div>
          <Tabs.List aria-label="Inspector view">
            <Tabs.Trigger value="default">Default</Tabs.Trigger>
            <Tabs.Trigger value="detailed">Detailed</Tabs.Trigger>
          </Tabs.List>
        </Frame.Header>
        <Frame.Panel className={styles.body()}>
          <ThemeControls
            theme={theme}
            onThemeChange={setTheme}
            scheme={scheme}
            onSchemeChange={setPickedScheme}
          />
          <Tabs.Content value="default">
            <PaletteOverview view={view} copy={copy} />
          </Tabs.Content>
          <Tabs.Content value="detailed">
            <PaletteTable view={view} />
          </Tabs.Content>
        </Frame.Panel>
        <Frame.Footer className={styles.footer()}>
          <span>
            {view.tones.length} tones · {view.roles.length} roles · {view.pairs.length} pairs
          </span>
          <CopyStatus copy={copy} />
          <span className={belowAa > 0 ? styles.failing() : undefined}>
            {belowAa === 0 ? "Every pair reaches AA" : `${String(belowAa)} below AA`}
          </span>
        </Frame.Footer>
      </Tabs.Root>
    </Tooltip.Provider>
  );
}
