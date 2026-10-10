"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Text } from "@elmeragroup/fuse/text";

import { formatTypePair } from "../../lib/type-metrics";
import { useArtboardScope } from "../studio-artboard";

const typeRow = tv({
  slots: {
    row: "grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4 border-b border-border py-3 last:border-b-0",
    meta: "flex min-w-0 flex-col gap-0.5",
    // Text sets relaxed leading; these keep each size's own.
    name: "leading-(--text-sm--line-height)",
    token: "font-mono leading-(--text-xs--line-height) break-all",
    value: "font-mono leading-(--text-xs--line-height) tabular-nums",
    sample: "min-w-0",
  },
});

const styles = typeRow();

export type TypeRowProps = {
  /** What the row shows, such as `H1` or `Field label`. */
  name: string;
  /** The tokens the sample reads, such as `--font-heading`. */
  tokens: string;
  /** The element in the sample whose computed type the row reports. */
  target: string;
  /** Also report the computed font weight. */
  weight?: boolean;
  children: ReactNode;
};

/** Reads the target's computed size over leading, and its weight when asked, as one line. */
function readType(row: HTMLElement, target: string, weight: boolean): string {
  const element = row.querySelector(target);
  if (element === null) {
    return "";
  }
  const style = getComputedStyle(element);
  const pair = formatTypePair(style.fontSize, style.lineHeight);
  return weight ? `${pair} · ${style.fontWeight}` : pair;
}

/**
 * One sample with the type the browser computed for it, read off the DOM: size over leading,
 * and weight when asked. It reads again after each change to anything the artboard's values
 * depend on: its theme, scheme, density and token declarations.
 */
export function TypeRow({ name, tokens, target, weight = false, children }: TypeRowProps): ReactElement {
  const { theme, scheme, density, style } = useArtboardScope();
  const row = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState("");
  useLayoutEffect(() => {
    const element = row.current;
    if (element === null) {
      return;
    }
    setReading(readType(element, target, weight));
  }, [target, weight, theme, scheme, density, style]);
  return (
    <div ref={row} className={styles.row()}>
      <div className={styles.meta()}>
        <Text elementType="span" size="sm" weight="medium" variant="foreground" className={styles.name()}>
          {name}
        </Text>
        <Text elementType="span" size="xs" variant="muted" className={styles.token()}>
          {tokens}
        </Text>
        <Text elementType="span" size="xs" variant="foreground" className={styles.value()} data-type-reading>
          {reading}
        </Text>
      </div>
      <div className={styles.sample()}>{children}</div>
    </div>
  );
}
