"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";
import { DENSITIES, densityAttributes } from "@elmeragroup/fuse/theme";

import { metricStyle } from "../../lib/density-metrics";
import { metricOverridesFor } from "../../lib/edits";
import { DENSITY_LABELS } from "../../lib/labels";
import { useStudioEdits } from "../studio-edits";
import { useStudio } from "../studio-state";

const glanceBoard = tv({
  slots: {
    root: "flex flex-col gap-8 p-8",
    section: "flex flex-col gap-3",
    swatches: "grid grid-cols-4 gap-3",
    swatch: "flex flex-col gap-1.5",
    // The role's color alone. Its name sits below, in text-grade foreground on the artboard's
    // background, since some roles' foregrounds, such as `feature-foreground`, are decorative.
    chip: "aspect-square rounded-md",
    swatchName: "text-xs font-medium text-foreground",
    rungs: "grid grid-cols-5 gap-3",
    rung: "flex flex-col items-center gap-2",
    rungBox: "size-16 border-2 border-primary bg-primary-soft",
    rungValue: "text-xs font-mono text-muted-foreground",
    densities: "grid grid-cols-2 gap-4",
    density: "flex flex-col items-start gap-2 rounded-md border border-border p-4",
    sizeRow: "flex items-center gap-3",
    sizeValue: "text-xs w-14 font-mono text-muted-foreground",
  },
  variants: {
    role: {
      background: { chip: "border border-border bg-background" },
      card: { chip: "border border-border bg-card" },
      primary: { chip: "bg-primary" },
      secondary: { chip: "bg-secondary" },
      feature: { chip: "bg-feature" },
      border: { chip: "bg-border" },
      error: { chip: "bg-error" },
      success: { chip: "bg-success" },
    },
    rung: {
      xs: { rungBox: "studio-rung-xs" },
      sm: { rungBox: "studio-rung-sm" },
      md: { rungBox: "studio-rung-md" },
      lg: { rungBox: "studio-rung-lg" },
      xl: { rungBox: "studio-rung-xl" },
    },
  },
});

const styles = glanceBoard();

type Role = keyof typeof glanceBoard.variants.role;
type Rung = keyof typeof glanceBoard.variants.rung;

const ROLES: readonly { role: Role; name: string }[] = [
  { role: "background", name: "Background" },
  { role: "card", name: "Card" },
  { role: "primary", name: "Primary" },
  { role: "secondary", name: "Secondary" },
  { role: "feature", name: "Feature" },
  { role: "border", name: "Border" },
  { role: "error", name: "Error" },
  { role: "success", name: "Success" },
];

const RUNGS: readonly Rung[] = ["xs", "sm", "md", "lg", "xl"];

/** Button's sizes. */
const CONTROL_SIZES = ["xs", "sm", "default", "lg"] as const;

/** One radius rung as a real rounded box, labeled with the radius the browser resolved. */
function RungBox({ rung }: { rung: Rung }): ReactElement {
  const { theme } = useStudio();
  const { styleFor } = useStudioEdits();
  const box = useRef<HTMLDivElement>(null);
  const [radius, setRadius] = useState("");
  // The rung follows the artboard's theme and token edits, so it is read back after each change.
  useLayoutEffect(() => {
    if (box.current !== null) {
      setRadius(getComputedStyle(box.current).borderTopLeftRadius);
    }
  }, [theme, styleFor]);
  return (
    <div className={styles.rung()}>
      <div ref={box} className={styles.rungBox({ rung })} />
      <span className={styles.rungValue()}>{radius === "" ? rung : `${rung} ${radius}`}</span>
    </div>
  );
}

/**
 * One Button size, labeled with the height the browser rendered: the density's control height
 * after metric edits, or the 24px target-size floor where that is taller.
 */
function SizeRow({ size }: { size: (typeof CONTROL_SIZES)[number] }): ReactElement {
  const { theme } = useStudio();
  const { overrides } = useStudioEdits();
  const button = useRef<HTMLButtonElement>(null);
  const [height, setHeight] = useState("");
  // The height follows the theme and metric edits, so it is read back after each change.
  useLayoutEffect(() => {
    if (button.current !== null) {
      setHeight(String(Number.parseFloat(getComputedStyle(button.current).height)));
    }
  }, [theme, overrides]);
  return (
    <div className={styles.sizeRow()}>
      <span className={styles.sizeValue()}>{height === "" ? "" : `${height} px`}</span>
      <Button ref={button} size={size} variant="outline">
        {size === "default" ? "md" : size}
      </Button>
    </div>
  );
}

/**
 * The base theme at a glance: its key color roles, its radius ladder and the control heights
 * each density gives Button's sizes. Every swatch, box and button is drawn by the theme itself.
 * Each density's stage redeclares its metrics, so it carries that density's metric edits too.
 */
export function GlanceBoard(): ReactElement {
  const { overrides } = useStudioEdits();
  return (
    <div className={styles.root()}>
      <section className={styles.section()} aria-label="Color roles">
        <Heading level={2} size="lg">
          Color roles
        </Heading>
        <div className={styles.swatches()}>
          {ROLES.map(({ role, name }) => (
            <div key={role} className={styles.swatch()}>
              <div className={styles.chip({ role })} />
              <span className={styles.swatchName()}>{name}</span>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.section()} aria-label="Radius">
        <Heading level={2} size="lg">
          Radius
        </Heading>
        <div className={styles.rungs()}>
          {RUNGS.map((rung) => (
            <RungBox key={rung} rung={rung} />
          ))}
        </div>
      </section>
      <section className={styles.section()} aria-label="Control heights">
        <Heading level={2} size="lg">
          Control heights
        </Heading>
        <div className={styles.densities()}>
          {DENSITIES.map((density) => (
            <div
              key={density}
              data-demo-stage
              {...densityAttributes(density)}
              // oxlint-disable-next-line shadcn/no-inline-styles -- metric edits: custom properties only (metricStyle), declared on the stage that redeclares the density's metrics
              style={metricStyle(metricOverridesFor(overrides, density))}
              className={styles.density()}>
              <Text weight="medium">{DENSITY_LABELS[density]}</Text>
              {CONTROL_SIZES.map((size) => (
                <SizeRow key={size} size={size} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
