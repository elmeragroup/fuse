"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { TextField } from "@elmeragroup/fuse/text-field";
import type { Density } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { useLandingTheme } from "./landing-theme";

const landingDensity = tv({
  slots: {
    section:
      "sm:px-6 sm:py-32 sm:gap-14 flex flex-col items-center gap-10 border-t border-border px-4 py-16 lg:px-20",
    head: "flex max-w-160 flex-col items-center gap-5 text-center",
    eyebrow: "text-xs tracking-landing-eyebrow font-mono text-primary",
    title: "text-4xl sm:text-landing-h3 tracking-landing-h2 font-semibold font-heading text-balance",
    note: "text-sm text-muted-foreground",
    card: "w-full max-w-140",
    form: "flex flex-col gap-4",
    row: "sm:grid-cols-2 grid grid-cols-1 gap-4",
    actions: "flex flex-wrap gap-3",
  },
});

const styles = landingDensity();

const DENSITIES = {
  dense: { label: "Dense", note: "Internal tools · 36 px controls" },
  comfortable: { label: "Comfortable", note: "Customer apps · 44 px controls" },
} as const satisfies Record<Density, { label: string; note: string }>;

/**
 * Density is a document axis, so the toggle switches the whole page instead of rendering the
 * two densities side by side in one document.
 */
export function LandingDensity(): ReactElement {
  const { density, changeDensity } = useLandingTheme();

  return (
    <section className={styles.section()} aria-labelledby="landing-density">
      <div className={styles.head()}>
        <p className={styles.eyebrow()}>data-density</p>
        <h2 id="landing-density" className={styles.title()}>
          Dense or comfortable, set per app.
        </h2>
        <ToggleGroup.Root
          aria-label="Density"
          variant="outline"
          spacing={0}
          value={[density]}
          onValueChange={(next) => {
            if (next[0] === "dense" || next[0] === "comfortable") {
              changeDensity(next[0]);
            }
          }}>
          {(["dense", "comfortable"] as const).map((option) => (
            <ToggleGroup.Item key={option} value={option}>
              {DENSITIES[option].label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <p className={styles.note()}>{DENSITIES[density].note}</p>
      </div>
      <Card.Root className={styles.card()}>
        <Card.Content>
          <form
            className={styles.form()}
            onSubmit={(event) => {
              event.preventDefault();
            }}>
            <TextField label="Meter number" filter="numeric" defaultValue="7070575000" />
            <div className={styles.row()}>
              <NumberField label="Reading" denomination="kWh" minValue={0} defaultValue={48213} />
              <TextField label="Date" defaultValue="02.10.2026" />
            </div>
            <div className={styles.actions()}>
              <Button type="submit">Save reading</Button>
              <Button type="reset" variant="ghost">
                Cancel
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card.Root>
    </section>
  );
}
