"use client";

import type { ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { BRANDS, DENSITIES, defaultDensityForVariant, themeSlug } from "@elmeragroup/fuse/theme";
import type { Density } from "@elmeragroup/fuse/theme";

import { leadSectionFor } from "../../lib/studio/documents";
import type { ArtboardScheme, ArtboardSpec } from "../../lib/studio/documents";
import { pinnedEdits } from "../../lib/studio/token-values";
import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import { SingleToggle } from "../single-toggle";
import { CornerReadout } from "./corner-xray";
import { DensityPanel } from "./density/density-panel";
import { useStudioEdits } from "./studio-edits";
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
    note: "text-sm m-0 px-2 text-muted-foreground",
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

const TOKEN_LIST = new Intl.ListFormat("en", { type: "conjunction" });

/**
 * With an artboard selected: its name, its scheme and density, both editable, and its width. A
 * pinned artboard also names the edits it skips because they would loop in its variant.
 */
function ArtboardSection({ artboard }: { artboard: ArtboardSpec }): ReactElement {
  const { theme, settingsOf, changeSettings } = useStudio();
  const { overrides } = useStudioEdits();
  const settings = settingsOf(artboard);
  const skipped =
    artboard.variant === undefined
      ? []
      : pinnedEdits({ theme, overrides }, artboard.variant, settings.scheme).skipped;
  return (
    <StudioPanelSection title="Artboard">
      <dl className={styles.list()}>
        <Row term="Name">{artboard.name}</Row>
        <Row term="Width">{`${String(artboard.width)} px`}</Row>
      </dl>
      {artboard.variant === undefined || skipped.length === 0 ? null : (
        <p className={styles.note()}>
          {`Skips ${TOKEN_LIST.format(skipped.map((name) => `--${name}`))}, which would loop through the ${VARIANT_LABELS[artboard.variant]} variant's own aliases.`}
        </p>
      )}
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
 * the selection's section, or the base theme's when nothing is selected, then the token editor,
 * led by the section the page names and, after it, the corners the X-ray measures while it is on.
 */
export function StudioInspector(): ReactElement {
  const { artboards, selectedId } = useStudio();
  const pathname = usePathname();
  const selected = artboards.find((artboard) => artboard.id === selectedId);
  return (
    <>
      {pathname === "/studio/density" ? <DensityPanel /> : null}
      {selected === undefined ? <BaseThemeSection /> : <ArtboardSection artboard={selected} />}
      <StudioTokenPanel lead={leadSectionFor(pathname)} afterLead={<CornerReadout />} />
    </>
  );
}
