"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { STUDIO_SLOT_TOKENS } from "../../generated/studio-slot-tokens";
import type { ArtboardSpec } from "../lib/documents";
import { SCHEME_LABELS } from "../lib/labels";
import { formatPx } from "../lib/measure";
import type { Sides } from "../lib/measure";
import { partTokens } from "../lib/slot-tokens";
import { useArtboardScopeOf } from "./studio-artboard";
import { StudioPanelSection } from "./studio-panel-section";
import { usePartMetrics, usePartSelection } from "./studio-part-selection";
import type { PickedPart } from "./studio-part-selection";
import { ReadoutList, ReadoutRow } from "./studio-readout";
import { useStudio } from "./studio-state";
import { TokenRow, useResolvedColors } from "./studio-token-panel";

const studioSelectionSection = tv({
  slots: {
    // Layout only: the scroll area sizes its content to fit, so the rows' long names and paired
    // controls would widen the panel; containment holds the section to the panel's width.
    root: "contain-inline-size",
    list: "px-2",
    heading: "px-2",
    tokens: "flex flex-col gap-3 px-2",
    empty: "px-2",
  },
});

const styles = studioSelectionSection();

/** Per-side lengths in CSS shorthand order, collapsed as the shorthand would collapse them. */
function shorthand({ top, right, bottom, left }: Sides): string {
  const values = [top, right, bottom, left].map(formatPx);
  if (top === bottom && right === left) {
    return `${top === right ? formatPx(top) : `${formatPx(top)} ${formatPx(right)}`} px`;
  }
  return `${values.join(" ")} px`;
}

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
        <ReadoutList className={styles.list()}>
          <ReadoutRow term="Slot" code>
            {part.slot}
          </ReadoutRow>
          <ReadoutRow term="Component">{read?.component ?? "Not a documented component"}</ReadoutRow>
          <ReadoutRow term="Scheme">{SCHEME_LABELS[scope.scheme]}</ReadoutRow>
          <ReadoutRow term="Density role" code={metrics?.role !== undefined}>
            {metrics?.role === undefined
              ? "Not declared"
              : metrics.role.key === part.slot
                ? metrics.role.role
                : `${metrics.role.role} (${metrics.role.key})`}
          </ReadoutRow>
          {metrics === undefined ? null : (
            <>
              <ReadoutRow term="Size">{`${formatPx(metrics.width)} × ${formatPx(metrics.height)} px`}</ReadoutRow>
              <ReadoutRow term="Padding">{shorthand(metrics.padding)}</ReadoutRow>
              <ReadoutRow term="Border">{shorthand(metrics.border)}</ReadoutRow>
              <ReadoutRow term="Radius">{`${formatPx(metrics.radius)} px`}</ReadoutRow>
            </>
          )}
        </ReadoutList>
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
