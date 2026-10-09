"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";
import { DENSITIES, densityAttributes } from "@elmeragroup/fuse/theme";
import type { Density } from "@elmeragroup/fuse/theme";

import { LANDING_FACTS } from "../../../generated/landing-facts";
import { useStudio } from "../studio-state";

const glanceBoard = tv({
  slots: {
    root: "flex flex-col gap-8 p-8",
    section: "flex flex-col gap-3",
    swatches: "grid grid-cols-4 gap-3",
    swatch: "flex flex-col gap-1.5",
    // The role's colour alone. Its name sits below, in text-grade foreground on the artboard's
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

/** Button's sizes, each with the control-height metric it reads. */
const CONTROL_SIZES = [
  { size: "xs", metric: "control-h-xs" },
  { size: "sm", metric: "control-h-sm" },
  { size: "default", metric: "control-h-md" },
  { size: "lg", metric: "control-h-lg" },
] as const;

const DENSITY_LABELS = { dense: "Dense", comfortable: "Comfortable" } as const satisfies Record<
  Density,
  string
>;

/** A control height in px at one density, from the library's density table. */
function controlHeight(metric: string, density: Density): number | undefined {
  return LANDING_FACTS.metrics.find((entry) => entry.name === metric)?.px[density];
}

/** One radius rung as a real rounded box, labelled with the radius the browser resolved. */
function RungBox({ rung }: { rung: Rung }): ReactElement {
  const { theme } = useStudio();
  const box = useRef<HTMLDivElement>(null);
  const [radius, setRadius] = useState("");
  // The rung follows the artboard's theme, so it is read back after every theme change.
  useLayoutEffect(() => {
    if (box.current !== null) {
      setRadius(getComputedStyle(box.current).borderTopLeftRadius);
    }
  }, [theme]);
  return (
    <div className={styles.rung()}>
      <div ref={box} className={styles.rungBox({ rung })} />
      <span className={styles.rungValue()}>{radius === "" ? rung : `${rung} ${radius}`}</span>
    </div>
  );
}

/**
 * The base theme at a glance: its key colour roles, its radius ladder and the control heights
 * each density gives Button's sizes. Every swatch, box and button is drawn by the theme itself.
 */
export function GlanceBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <section className={styles.section()} aria-label="Colour roles">
        <Heading level={2} size="lg">
          Colour roles
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
            <div key={density} data-demo-stage {...densityAttributes(density)} className={styles.density()}>
              <Text weight="medium">{DENSITY_LABELS[density]}</Text>
              {CONTROL_SIZES.map(({ size, metric }) => (
                <div key={size} className={styles.sizeRow()}>
                  <span className={styles.sizeValue()}>{`${String(controlHeight(metric, density))} px`}</span>
                  <Button size={size} variant="outline">
                    {size === "default" ? "md" : size}
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
