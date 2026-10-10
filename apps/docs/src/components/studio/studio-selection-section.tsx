"use client";

import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { STUDIO_SLOT_TOKENS } from "../../generated/studio-slot-tokens";
import type { ArtboardScheme, ArtboardSpec } from "../../lib/studio/documents";
import { partTokens } from "../../lib/studio/slot-tokens";
import { useArtboardScopeOf } from "./studio-artboard";
import { StudioPanelSection } from "./studio-panel-section";
import { usePartMetrics, usePartSelection } from "./studio-part-selection";
import type { PickedPart, Sides } from "./studio-part-selection";
import { useStudio } from "./studio-state";
import { TokenRow, useResolvedColors } from "./studio-token-panel";

const studioSelectionSection = tv({
  slots: {
    // Layout only: the scroll area sizes its content to fit, so the rows' long names and paired
    // controls would widen the panel; containment holds the section to the panel's width.
    root: "contain-inline-size",
    list: "px-2",
    detail: "min-w-0 wrap-break-word tabular-nums",
    heading: "px-2",
    tokens: "flex flex-col gap-3 px-2",
    empty: "px-2",
  },
  variants: {
    // An identifier the reader matches against source, set in the list's own size and leading.
    code: { true: { detail: "font-mono" } },
  },
});

const styles = studioSelectionSection();

/** A term and its value in the section's list; `code` sets the value as an identifier. */
function Row({ term, code, children }: { term: string; code?: boolean; children: ReactNode }): ReactElement {
  return (
    <>
      <DescriptionList.Term>{term}</DescriptionList.Term>
      <DescriptionList.Details className={styles.detail({ code })}>{children}</DescriptionList.Details>
    </>
  );
}

/** Rounds a measured length to a tenth of a px, as the readout shows it. */
function px(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Per-side lengths in CSS shorthand order, collapsed as the shorthand would collapse them. */
function shorthand({ top, right, bottom, left }: Sides): string {
  const values = [top, right, bottom, left].map(px);
  if (top === bottom && right === left) {
    return `${top === right ? px(top) : `${px(top)} ${px(right)}`} px`;
  }
  return `${values.join(" ")} px`;
}

const SCHEME_LABELS = { light: "Light", dark: "Dark" } as const satisfies Record<ArtboardScheme, string>;

/** The picked part's readout. It mounts with the pick, so its color probe resolves on arrival. */
function PartDetails({ part, artboard }: { part: PickedPart; artboard: ArtboardSpec }): ReactElement {
  const metrics = usePartMetrics();
  // The artboard's own scope, which it wears: its scheme, not the edited one, and its pin.
  const scope = useArtboardScopeOf(artboard);
  const { colors, probe } = useResolvedColors(scope.scheme, scope);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.scrollIntoView({ block: "nearest" });
  }, [part]);

  const read = partTokens(STUDIO_SLOT_TOKENS, part.slot);
  return (
    <div ref={root} className={styles.root()} data-selection-section>
      <StudioPanelSection title="Selection">
        <DescriptionList.Root className={styles.list()}>
          <DescriptionList.Content>
            <Row term="Slot" code>
              {part.slot}
            </Row>
            <Row term="Component">{read?.component ?? "Not a documented component"}</Row>
            <Row term="Scheme">{SCHEME_LABELS[scope.scheme]}</Row>
            <Row term="Density role" code={metrics?.role !== undefined}>
              {metrics?.role === undefined
                ? "Not declared"
                : metrics.role.key === part.slot
                  ? metrics.role.role
                  : `${metrics.role.role} (${metrics.role.key})`}
            </Row>
            {metrics === undefined ? null : (
              <>
                <Row term="Size">{`${px(metrics.width)} × ${px(metrics.height)} px`}</Row>
                <Row term="Padding">{shorthand(metrics.padding)}</Row>
                <Row term="Border">{shorthand(metrics.border)}</Row>
                <Row term="Radius">{`${px(metrics.radius)} px`}</Row>
              </>
            )}
          </DescriptionList.Content>
        </DescriptionList.Root>
        <Heading level={3} size="sm" variant="muted" noMargin className={styles.heading()}>
          Tokens it reads
        </Heading>
        {read === undefined || read.tokens.length === 0 ? (
          <Text size="sm" variant="muted" className={styles.empty()}>
            No role tokens.
          </Text>
        ) : (
          <div className={styles.tokens()}>
            {probe}
            {scope.seed === undefined
              ? null
              : read.tokens.map((name) => <TokenRow key={name} name={name} colors={colors} scope={scope} />)}
          </div>
        )}
      </StudioPanelSection>
    </div>
  );
}

/**
 * The inspector's first section while a part is picked: its slot and component, its density
 * role, its size and box, and the role tokens its component reads, each with its knob, so the
 * answer to "what do I turn to change this?" sits next to the part. The rows describe the part
 * in its artboard's scope, its scheme and a pinned variant included, with the declarations the
 * artboard wears; their edits apply to that scheme on every artboard, as the token panel's do. Picking a part scrolls the section into view.
 */
export function SelectionSection(): ReactElement | null {
  const { part } = usePartSelection();
  const { artboards } = useStudio();
  const artboard = artboards.find((each) => each.id === part?.artboard);
  return part === undefined || artboard === undefined ? null : (
    <PartDetails part={part} artboard={artboard} />
  );
}
