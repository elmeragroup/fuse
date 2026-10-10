"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { ArrowsClockwise } from "@elmeragroup/fuse/icons";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { Slider } from "@elmeragroup/fuse/slider";
import { Table } from "@elmeragroup/fuse/table";
import { Text } from "@elmeragroup/fuse/text";
import { DENSITIES } from "@elmeragroup/fuse/theme";
import type { Density } from "@elmeragroup/fuse/theme";
import type { DensityRole } from "@elmeragroup/fuse/theme-catalog";

import { MAX_METRIC_PX, STUDIO_METRICS, metricPx } from "../../lib/density-metrics";
import type { StudioMetric } from "../../lib/density-metrics";
import type { InspectedPart } from "../../lib/density-parts";
import { metricOverridesFor } from "../../lib/edits";
import { DENSITY_LABELS } from "../../lib/labels";
import { useStudioEdits } from "../studio-edits";
import { StudioPanelSection } from "../studio-panel-section";
import { ReadoutList, ReadoutRow } from "../studio-readout";
import { useStudio } from "../studio-state";
import { numberFieldBoundaries, sliderBoundaries, useGesture } from "../token-knobs";
import { useDensityView } from "./density-view";

const densityPanel = tv({
  slots: {
    // Layout only: the knobs' fit-content width would otherwise widen the inspector's column.
    panel: "contain-inline-size",
    part: "flex flex-col gap-2 px-2",
    metrics: "text-xs m-0 flex list-none flex-col gap-0.5 p-0 font-mono",
    metric: "flex min-w-0 items-baseline justify-between gap-2",
    metricName: "min-w-0 break-all",
    metricValue: "shrink-0 tabular-nums",
    trigger: "text-sm min-h-6 gap-2",
    count: "ml-auto",
    table: "table-fixed",
    name: "text-xs font-normal font-mono break-all",
    cell: "align-top",
    knob: "flex min-w-0 flex-col gap-1.5",
    knobFoot: "flex min-w-0 items-center gap-1",
    slider: "min-w-0 flex-1",
    note: "text-xs text-muted-foreground",
  },
});

const styles = densityPanel();

/** The roles that read metrics, each a section of the editor, in CONTEXT.md order. */
const METRIC_ROLES = [
  { role: "control", title: "Control metrics" },
  { role: "row", title: "Row metrics" },
  { role: "label", title: "Label text" },
  { role: "surface", title: "Surface metrics" },
] as const satisfies readonly { role: DensityRole; title: string }[];

/** The library's 24px target floor: xs controls take `max(var(--control-h-xs), 24px)`. */
const TARGET_FLOOR_PX = 24;

type MetricKnobProps = {
  metric: StudioMetric;
  density: Density;
};

/**
 * One metric at one density: a NumberField in px over the Fuse Slider, and its reset. The undo
 * boundaries are the token knobs': a slider drag or held key is one step, and in the field a
 * typing burst, each stepper press and each stepping key press is its own.
 */
function MetricKnob({ metric, density }: MetricKnobProps): ReactElement {
  const { overrides, edit } = useStudioEdits();
  const edited = metricOverridesFor(overrides, density)[metric.name];
  const px = edited ?? metric.px[density];
  const label = `--${metric.name} ${density}`;
  const sliding = useGesture();
  const field = useGesture();
  const commit = (next: number, coalesce: string) => {
    edit({ type: "set-metric", density, name: metric.name, px: next, coalesce });
  };
  return (
    <div className={styles.knob()}>
      {/* Layout, and the field's undo boundaries: a typing burst, a stepper press or a key press. */}
      <div {...numberFieldBoundaries(field.end)}>
        <NumberField
          aria-label={`${label} in px`}
          value={px}
          minValue={0}
          maxValue={MAX_METRIC_PX}
          step={1}
          onChange={(next) => {
            if (!Number.isNaN(next)) {
              commit(next, field.key());
            }
          }}
        />
      </div>
      <div className={styles.knobFoot()}>
        {/* Layout, and the slider gesture's boundary: a press starts one, a release ends it. */}
        <div className={styles.slider()} {...sliderBoundaries(sliding.end)}>
          <Slider
            aria-label={label}
            value={px}
            minValue={0}
            maxValue={MAX_METRIC_PX}
            step={1}
            onChange={(next) => {
              commit(next, sliding.key());
            }}
          />
        </div>
        {/* Always laid out, so an edit never reflows the row; it enables once there is an edit. */}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Reset ${label}`}
          disabled={edited === undefined}
          onClick={() => {
            edit({ type: "reset-metric", density, name: metric.name });
          }}>
          <ArrowsClockwise />
        </Button>
      </div>
    </div>
  );
}

/** One role's metrics as a table: a row per metric, a column per density. */
function MetricTable({ role, title }: { role: DensityRole; title: string }): ReactElement {
  const { overrides } = useStudioEdits();
  const metrics = STUDIO_METRICS.filter((metric) => metric.role === role);
  return (
    <Table.Root className={styles.table()} aria-label={title}>
      <Table.Header>
        <Table.Row>
          {DENSITIES.map((density) => (
            <Table.Head key={density} scope="col">
              {DENSITY_LABELS[density]}
            </Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      {metrics.map((metric) => {
        const floored = DENSITIES.filter(
          (density) =>
            metric.name === "control-h-xs" &&
            metricPx(metric, density, metricOverridesFor(overrides, density)) < TARGET_FLOOR_PX
        );
        return (
          <Table.Body key={metric.name} data-metric={metric.name}>
            <Table.Row>
              <Table.Head scope="colgroup" colSpan={DENSITIES.length} className={styles.name()}>
                {`--${metric.name}`}
              </Table.Head>
            </Table.Row>
            <Table.Row>
              {DENSITIES.map((density) => (
                <Table.Cell key={density} className={styles.cell()}>
                  <MetricKnob metric={metric} density={density} />
                </Table.Cell>
              ))}
            </Table.Row>
            {floored.length === 0 ? null : (
              <Table.Row>
                <Table.Cell colSpan={DENSITIES.length}>
                  <Text className={styles.note()} role="note">
                    {`The 24px target floor holds xs controls at 24px: Fuse sizes them with max(var(--control-h-xs), 24px), so ${floored.map((density) => DENSITY_LABELS[density].toLowerCase()).join(" and ")} xs controls stay 24px tall.`}
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        );
      })}
    </Table.Root>
  );
}

/**
 * The overlays' text alternative: the hovered or focused part's slot, role and metrics, at its
 * artboard's density now, so changing that artboard's density updates it.
 */
function InspectedPartDetails({ part }: { part: InspectedPart | undefined }): ReactElement {
  const { overrides } = useStudioEdits();
  const { artboards, settingsOf } = useStudio();
  const artboard = artboards.find((spec) => spec.id === part?.artboard);
  if (part === undefined || artboard === undefined) {
    return (
      <Text className={styles.note()}>
        Point at or focus a part in an artboard to see its density role and the metrics it reads.
      </Text>
    );
  }
  const { density } = settingsOf(artboard);
  const metrics = STUDIO_METRICS.filter((metric) => metric.role === part.role);
  const edits = metricOverridesFor(overrides, density);
  return (
    <ReadoutList aria-label="Inspected part">
      <ReadoutRow term="Slot" code>
        {part.slot}
      </ReadoutRow>
      {part.key === part.slot ? null : (
        <ReadoutRow term="Key" code>
          {part.key}
        </ReadoutRow>
      )}
      <ReadoutRow term="Density role" code>
        {part.role}
      </ReadoutRow>
      <ReadoutRow term="Density">{DENSITY_LABELS[density]}</ReadoutRow>
      <ReadoutRow term="Reads">
        {metrics.length === 0 ? (
          "No density metric"
        ) : (
          <ul className={styles.metrics()}>
            {metrics.map((metric) => (
              <li key={metric.name} className={styles.metric()}>
                <span className={styles.metricName()}>{`--${metric.name}`}</span>
                <span
                  className={styles.metricValue()}>{`${String(metricPx(metric, density, edits))}px`}</span>
              </li>
            ))}
          </ul>
        )}
      </ReadoutRow>
    </ReadoutList>
  );
}

/**
 * The Density page's inspector section: the part the overlays describe, in text, then every
 * density metric as a Dense | Comfortable table per role, each value a NumberField and a Slider
 * in px. A dense edit applies to dense artboards and a comfortable edit to comfortable ones.
 */
export function DensityPanel(): ReactElement {
  const { inspected } = useDensityView();
  const { overrides } = useStudioEdits();
  return (
    <div className={styles.panel()}>
      <StudioPanelSection title="Density">
        <div className={styles.part()}>
          <InspectedPartDetails part={inspected} />
        </div>
        <Accordion.Root multiple defaultValue={["control"]}>
          {METRIC_ROLES.map(({ role, title }) => {
            const count = DENSITIES.reduce(
              (total, density) =>
                total +
                STUDIO_METRICS.filter(
                  (metric) =>
                    metric.role === role && metricOverridesFor(overrides, density)[metric.name] !== undefined
                ).length,
              0
            );
            return (
              <Accordion.Item key={role} value={role}>
                <Accordion.Header>
                  <Accordion.Trigger className={styles.trigger()}>
                    {title}
                    {count === 0 ? null : (
                      <Badge size="sm" variant="secondary" className={styles.count()}>
                        {String(count)}
                        <span className="sr-only"> edited</span>
                      </Badge>
                    )}
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  <MetricTable role={role} title={title} />
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      </StudioPanelSection>
    </div>
  );
}
