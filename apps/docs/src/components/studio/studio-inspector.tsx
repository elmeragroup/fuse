"use client";

import type { ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { BRANDS, DENSITIES, defaultDensityForVariant, themeSlug } from "@elmeragroup/fuse/theme";
import type { Density } from "@elmeragroup/fuse/theme";

import type { ArtboardScheme, ArtboardSpec } from "../../lib/studio/documents";
import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import { SingleToggle } from "../single-toggle";
import { DensityPanel } from "./density/density-panel";
import { StudioPanelSection } from "./studio-panel-section";
import { useStudio } from "./studio-state";
import { StudioTokenPanel } from "./studio-token-panel";

const studioInspector = tv({
  slots: {
    list: "text-sm m-0 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-2",
    term: "text-muted-foreground",
    detail: "m-0 min-w-0 wrap-break-word",
    // A slug breaks only after its hyphens, never inside a word.
    code: "font-mono",
    field: "flex flex-col gap-1.5 px-2",
    fieldLabel: "text-sm text-muted-foreground",
  },
});

const styles = studioInspector();

const SCHEMES = ["light", "dark"] as const satisfies readonly ArtboardScheme[];

const SCHEME_LABELS = { light: "Light", dark: "Dark" } as const satisfies Record<ArtboardScheme, string>;

const DENSITY_LABELS = { dense: "Dense", comfortable: "Comfortable" } as const satisfies Record<
  Density,
  string
>;

/** A term and its value in an inspector list. */
function Row({ term, children }: { term: string; children: ReactNode }): ReactElement {
  return (
    <>
      <dt className={styles.term()}>{term}</dt>
      <dd className={styles.detail()}>{children}</dd>
    </>
  );
}

/** With nothing selected: the base theme every artboard renders in. */
function BaseThemeSection(): ReactElement {
  const { theme } = useStudio();
  return (
    <StudioPanelSection title="Base theme">
      <dl className={styles.list()}>
        <Row term="Slug">
          <span className={styles.code()}>{themeSlug(theme)}</span>
        </Row>
        <Row term="Variant">{VARIANT_LABELS[theme.variant]}</Row>
        <Row term="Brand">{BRANDS[theme.brand].displayName}</Row>
        <Row term="Segment">{SEGMENT_LABELS[theme.segment]}</Row>
        <Row term="Density">{DENSITY_LABELS[defaultDensityForVariant(theme.variant)]}</Row>
      </dl>
    </StudioPanelSection>
  );
}

/** With an artboard selected: its name, its scheme and density, both editable, and its width. */
function ArtboardSection({ artboard }: { artboard: ArtboardSpec }): ReactElement {
  const { settingsOf, changeSettings } = useStudio();
  const settings = settingsOf(artboard);
  return (
    <StudioPanelSection title="Artboard">
      <dl className={styles.list()}>
        <Row term="Name">{artboard.name}</Row>
        <Row term="Width">{`${String(artboard.width)} px`}</Row>
      </dl>
      <div className={styles.field()}>
        <span className={styles.fieldLabel()}>Scheme</span>
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
        <span className={styles.fieldLabel()}>Density</span>
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
 * The right panel. It is plain composition: the Density page's own section first on that page,
 * the selection's section, or the base theme's when nothing is selected, then the token editor.
 */
export function StudioInspector(): ReactElement {
  const { artboards, selectedId } = useStudio();
  const pathname = usePathname();
  const selected = artboards.find((artboard) => artboard.id === selectedId);
  return (
    <>
      {pathname === "/studio/density" ? <DensityPanel /> : null}
      {selected === undefined ? <BaseThemeSection /> : <ArtboardSection artboard={selected} />}
      <StudioTokenPanel />
    </>
  );
}
