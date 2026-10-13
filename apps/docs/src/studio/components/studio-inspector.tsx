"use client";

import type { ReactElement } from "react";

import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { Select } from "@elmeragroup/fuse/select";
import { Span } from "@elmeragroup/fuse/span";
import { Text } from "@elmeragroup/fuse/text";
import { BRANDS, DENSITIES, defaultDensityForVariant, themeSlug } from "@elmeragroup/fuse/theme";

import { SingleToggle } from "../../components/single-toggle";
import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import { hasDensityPanel, leadSectionsFor } from "../lib/documents";
import type { ArtboardScheme, ArtboardSpec } from "../lib/documents";
import { DENSITY_LABELS, SCHEME_LABELS } from "../lib/labels";
import { themeLabel } from "../lib/theme-axes";
import { artboardEdits } from "../lib/token-values";
import {
  BRAND_NAMES,
  BrandOptions,
  SegmentToggle,
  VariantToggle,
  useArtboardTheme,
} from "./artboard-theme-controls";
import { CornerReadout } from "./corner-xray";
import { DensityPanel } from "./density/density-panel";
import { useStudioEdits } from "./studio-edits";
import { StudioPanelSection } from "./studio-panel-section";
import { ReadoutList, ReadoutRow } from "./studio-readout";
import { SelectionSection } from "./studio-selection-section";
import { useStudio } from "./studio-state";
import { StudioTokenPanel } from "./studio-token-panel";

const studioInspector = tv({
  slots: {
    list: "px-2",
    field: "flex flex-col gap-1.5 px-2",
    note: "m-0 px-2",
    select: "w-full",
  },
});

const styles = studioInspector();

const SCHEMES = ["light", "dark"] as const satisfies readonly ArtboardScheme[];

/**
 * With nothing selected: the base theme every artboard renders in, and where a first visit
 * starts editing.
 */
function BaseThemeSection(): ReactElement {
  const { theme } = useStudio();
  return (
    <StudioPanelSection title="Base theme">
      <ReadoutList className={styles.list()}>
        <ReadoutRow term="Slug" code>
          {themeSlug(theme)}
        </ReadoutRow>
        <ReadoutRow term="Variant">{VARIANT_LABELS[theme.variant]}</ReadoutRow>
        <ReadoutRow term="Brand">{BRANDS[theme.brand].displayName}</ReadoutRow>
        <ReadoutRow term="Segment">{SEGMENT_LABELS[theme.segment]}</ReadoutRow>
        <ReadoutRow term="Density">{DENSITY_LABELS[defaultDensityForVariant(theme.variant)]}</ReadoutRow>
      </ReadoutList>
      <Text size="sm" variant="muted" className={styles.note()}>
        Tune the tokens below. Each edit applies to every artboard, on every page.
      </Text>
    </StudioPanelSection>
  );
}

const TOKEN_LIST = new Intl.ListFormat("en", { type: "conjunction" });

/**
 * With an artboard selected: its name and width, then its theme, brand, variant and segment, its
 * scheme and its density, all editable as on the theme toolbar. An artboard in a theme of its own
 * names the edits it skips because they would loop in that theme.
 */
function ArtboardSection({ artboard }: { artboard: ArtboardSpec }): ReactElement {
  const { theme: base, settingsOf, changeSettings } = useStudio();
  const { overrides } = useStudioEdits();
  const settings = settingsOf(artboard);
  const { theme, change } = useArtboardTheme(artboard);
  const own = themeSlug(theme) !== themeSlug(base);
  const skipped = own ? artboardEdits(overrides, theme, settings.scheme).skipped : [];
  return (
    <StudioPanelSection title="Artboard">
      <ReadoutList className={styles.list()}>
        <ReadoutRow term="Name">{artboard.name}</ReadoutRow>
        <ReadoutRow term="Width">{`${String(artboard.width)} px`}</ReadoutRow>
      </ReadoutList>
      {skipped.length === 0 ? null : (
        <Text size="sm" variant="muted" className={styles.note()}>
          {`Skips ${TOKEN_LIST.format(skipped.map((name) => `--${name}`))}, which would loop through the aliases of ${themeLabel(theme)}.`}
        </Text>
      )}
      <div className={styles.field()}>
        <Span size="sm" variant="muted">
          Brand
        </Span>
        <Select.Root
          items={BRAND_NAMES}
          value={theme.brand}
          onValueChange={(brand) => {
            if (brand !== null) {
              change({ brand });
            }
          }}>
          <Select.Trigger size="sm" aria-label="Brand" className={styles.select()}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <BrandOptions />
          </Select.Content>
        </Select.Root>
      </div>
      <div className={styles.field()}>
        <Span size="sm" variant="muted">
          Variant
        </Span>
        <VariantToggle artboard={artboard} />
      </div>
      <div className={styles.field()}>
        <Span size="sm" variant="muted">
          Segment
        </Span>
        <SegmentToggle artboard={artboard} />
      </div>
      <div className={styles.field()}>
        <Span size="sm" variant="muted">
          Scheme
        </Span>
        <SingleToggle
          label="Scheme"
          size="sm"
          options={SCHEMES}
          labels={SCHEME_LABELS}
          value={settings.scheme}
          onValueChange={(scheme) => {
            changeSettings(artboard.id, { scheme });
          }}
        />
      </div>
      <div className={styles.field()}>
        <Span size="sm" variant="muted">
          Density
        </Span>
        <SingleToggle
          label="Density"
          size="sm"
          options={DENSITIES}
          labels={DENSITY_LABELS}
          value={settings.density}
          onValueChange={(density) => {
            changeSettings(artboard.id, { density });
          }}
        />
      </div>
    </StudioPanelSection>
  );
}

/**
 * The right panel. It is plain composition: the picked part's section first, the Density page's
 * own section on that page, the selected artboard's section, or the base theme's when nothing is
 * selected, then the token editor, led by the sections the page names and, after them, the
 * corners the X-ray measures while it is on.
 */
export function StudioInspector(): ReactElement {
  const { artboards, selectedId } = useStudio();
  const pathname = usePathname();
  const selected = artboards.find((artboard) => artboard.id === selectedId);
  return (
    <>
      <SelectionSection />
      {hasDensityPanel(pathname) ? <DensityPanel /> : null}
      {selected === undefined ? <BaseThemeSection /> : <ArtboardSection artboard={selected} />}
      <StudioTokenPanel lead={leadSectionsFor(pathname)} afterLead={<CornerReadout />} />
    </>
  );
}
