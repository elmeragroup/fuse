"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Heading } from "@elmeragroup/fuse/heading";
import { Input } from "@elmeragroup/fuse/input";
import { Skeleton } from "@elmeragroup/fuse/skeleton";
import { Text } from "@elmeragroup/fuse/text";

import { RUNGS, rungFormula } from "../../lib/corners";
import type { RungId } from "../../lib/corners";
import { formatPx } from "../../lib/measure";
import { lengthPx } from "../../lib/token-values";
import { useArtboardScope } from "../studio-artboard";

const rungsBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    head: "flex flex-col gap-1",
    values: "text-sm font-mono text-muted-foreground",
    grid: "grid grid-cols-4 gap-x-4 gap-y-6",
    rung: "flex min-w-0 flex-col gap-1.5",
    // A Skeleton: Fuse's shape-only box, which takes its radius from the caller, never pulsing
    // here. Its own `rounded-md` merges away under a t-shirt rung; `popover` and `button` are
    // not in the merge's radius scale, so they are marked important to win over it.
    box: "h-16 animate-none border-2 border-primary bg-primary-soft",
    field: "h-16",
    name: "text-xs font-medium font-mono text-foreground",
    value: "text-sm font-mono tabular-nums",
    formula: "text-xs text-muted-foreground",
  },
  variants: {
    corner: {
      xs: { box: "rounded-xs" },
      sm: { box: "rounded-sm" },
      md: { box: "rounded-md" },
      lg: { box: "rounded-lg" },
      xl: { box: "rounded-xl" },
      popover: { box: "rounded-popover!" },
      button: { box: "rounded-button!" },
    },
  },
});

const styles = rungsBoard();

type Corner = RungId | "button";

/** The corners beyond the rungs: Button's role and the field box's own corner. */
const ROLE_CORNERS = [
  { id: "button", name: "--radius-button", formula: "the theme's button role" },
] as const satisfies readonly { id: Corner; name: string; formula: string }[];

const VARIANT_NAMES = { internal: "Internal", external: "External" } as const;

/**
 * Reads the radius every `[data-corner]` box under `root` computes, and the scope's `--radius`
 * and `--radius-step`, after each change to anything the artboard's values depend on: its
 * theme, scheme, density and token declarations.
 */
function useMeasuredCorners() {
  const { theme, scheme, density, style } = useArtboardScope();
  const root = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{
    corners: Readonly<Record<string, string>>;
    radius: string;
    step: string;
  }>({ corners: {}, radius: "", step: "" });
  useLayoutEffect(() => {
    const element = root.current;
    if (element === null) {
      return;
    }
    const corners: Record<string, string> = {};
    for (const box of element.querySelectorAll<HTMLElement>("[data-corner]")) {
      corners[box.dataset.corner ?? ""] = getComputedStyle(box).borderTopLeftRadius;
    }
    const scope = getComputedStyle(element);
    const px = (name: string) => {
      const value = lengthPx(scope.getPropertyValue(name));
      return value === undefined ? "" : `${formatPx(value)}px`;
    };
    setMeasured({ corners, radius: px("--radius"), step: px("--radius-step") });
  }, [theme, scheme, density, style]);
  return { root, measured };
}

/** One corner: the real rounded box, its name, the px the browser computed and its formula. */
function CornerTile({
  corner,
  name,
  value,
  formula,
}: {
  corner: Corner;
  name: string;
  value: string | undefined;
  formula: string;
}): ReactElement {
  return (
    <div className={styles.rung()}>
      <Skeleton className={styles.box({ corner })} data-corner={corner} />
      <span className={styles.name()}>{name}</span>
      <span className={styles.value()} data-corner-value={corner}>
        {value ?? "…"}
      </span>
      <span className={styles.formula()}>{formula}</span>
    </div>
  );
}

/**
 * The radius rungs of one variant of the base theme, each a real box rounded by its `rounded-*`
 * utility and labelled with the radius the browser resolved, beside the rung's formula. Two of
 * these, one per variant, show the 0px step against the 2px one.
 */
export function RungsBoard({ variant }: { variant: keyof typeof VARIANT_NAMES }): ReactElement {
  const { root, measured } = useMeasuredCorners();
  return (
    <div ref={root} className={styles.root()}>
      <div className={styles.head()}>
        <Heading level={2} size="lg">
          {`Radius rungs · ${VARIANT_NAMES[variant]}`}
        </Heading>
        <Text variant="muted" size="sm">
          Every rung sits whole steps from the theme&apos;s radius. The variant sets the step.
        </Text>
        <span className={styles.values()} data-scope-values>
          {`radius ${measured.radius || "…"} · step ${measured.step || "…"}`}
        </span>
      </div>
      <div className={styles.grid()}>
        {RUNGS.map(({ id, steps }) => (
          <CornerTile
            key={id}
            corner={id}
            name={`rounded-${id}`}
            value={measured.corners[id]}
            formula={rungFormula(steps)}
          />
        ))}
        {ROLE_CORNERS.map(({ id, name, formula }) => (
          <CornerTile key={id} corner={id} name={name} value={measured.corners[id]} formula={formula} />
        ))}
        <div className={styles.rung()}>
          <Input
            aria-label={`Field corner, ${VARIANT_NAMES[variant]}`}
            defaultValue="Field"
            readOnly
            className={styles.field()}
            data-corner="field"
          />
          <span className={styles.name()}>field corner</span>
          <span className={styles.value()} data-corner-value="field">
            {measured.corners.field ?? "…"}
          </span>
          <span className={styles.formula()}>radius at a 0px step, else --radius-field</span>
        </div>
      </div>
    </div>
  );
}
