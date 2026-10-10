"use client";

import { useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Heading } from "@elmeragroup/fuse/heading";
import { Skeleton } from "@elmeragroup/fuse/skeleton";
import { Slider } from "@elmeragroup/fuse/slider";
import { Text } from "@elmeragroup/fuse/text";

import { checkCorner, cornerEquation, innerCorner } from "../../lib/corners";
import { formatPx } from "../../lib/measure";

const concentricLab = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    head: "flex flex-col gap-1",
    knobs: "grid grid-cols-3 gap-6",
    panels: "grid grid-cols-2 gap-8",
    panel: "flex flex-col gap-3",
    // The shell and its child are Skeletons, Fuse's shape-only boxes, still here: they take the
    // lab's local numbers, never a token, and publish no corner of their own.
    shell:
      "animate-none rounded-(--lab-outer) border-(length:--lab-border) border-primary bg-primary-soft p-(--lab-pad)",
    child: "shadow-xs h-32 animate-none rounded-(--lab-inner) bg-card",
    formula: "flex flex-wrap items-center gap-2",
    equation: "text-sm font-mono tabular-nums",
  },
});

const styles = concentricLab();

/** The lab's opening numbers, in px: a card-like shell. */
const OPENING = { outer: 16, padding: 12, border: 1 } as const;

type Panel = { readonly name: string; readonly inner: number; readonly equation: string };

/**
 * The concentric explainer: a bordered, padded shell with a child panel, drawn twice. The
 * concentric child rounds with the outer corner less the inset, the naive one with the outer
 * corner itself, so the uneven gap at the naive corner shows at a glance. Its sliders are local
 * to this artboard and edit no token.
 */
export function ConcentricLab(): ReactElement {
  const [outer, setOuter] = useState<number>(OPENING.outer);
  const [padding, setPadding] = useState<number>(OPENING.padding);
  const [border, setBorder] = useState<number>(OPENING.border);
  const reading = { outer, border, padding };
  const { clamped } = checkCorner({ ...reading, inner: innerCorner(outer, border + padding) });
  const panels: readonly Panel[] = [
    { name: "Concentric", inner: innerCorner(outer, border + padding), equation: cornerEquation(reading) },
    { name: "Naive", inner: outer, equation: `inner = outer = ${formatPx(outer)}px` },
  ];

  return (
    <div className={styles.root()}>
      <div className={styles.head()}>
        <Heading level={2} size="lg">
          Concentric corners
        </Heading>
        <Text variant="muted" size="sm">
          An inner part rounds with its shell&apos;s corner less the inset, the shell&apos;s padding plus its
          border. These sliders are local to this explainer and change no token.
        </Text>
      </div>
      <div className={styles.knobs()}>
        <Slider
          label="Outer radius (local)"
          showValue
          minValue={0}
          maxValue={40}
          value={outer}
          onChange={setOuter}
        />
        <Slider
          label="Padding (local)"
          showValue
          minValue={0}
          maxValue={32}
          value={padding}
          onChange={setPadding}
        />
        <Slider
          label="Border (local)"
          showValue
          minValue={0}
          maxValue={8}
          value={border}
          onChange={setBorder}
        />
      </div>
      <div className={styles.panels()}>
        {panels.map((panel) => {
          const lab: CSSProperties & Record<`--${string}`, string> = {
            "--lab-outer": `${String(outer)}px`,
            "--lab-pad": `${String(padding)}px`,
            "--lab-border": `${String(border)}px`,
            "--lab-inner": `${String(panel.inner)}px`,
          };
          return (
            <section key={panel.name} aria-label={panel.name} className={styles.panel()}>
              <Heading level={3} size="sm">
                {panel.name}
              </Heading>
              <Skeleton className={styles.shell()} style={lab}>
                <Skeleton className={styles.child()} data-lab-child={panel.name} />
              </Skeleton>
              <div className={styles.formula()}>
                <span className={styles.equation()} data-lab-equation={panel.name}>
                  {panel.equation}
                </span>
                {panel.name === "Concentric" && clamped ? (
                  <Badge size="sm" variant="outline-warning">
                    Clamped to 0
                  </Badge>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
