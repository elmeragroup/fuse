"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { STUDIO_PRIMITIVES } from "../../../generated/studio-seeds";
import { studioToasts } from "../studio-persistence";

const primitivesBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    section: "flex flex-col gap-3",
    grid: "grid grid-cols-4 gap-2",
    button: "h-auto w-full flex-col items-stretch gap-1.5 p-1.5",
    // Decorative: the primitive's own value. The button names it.
    chip: "h-12 rounded-sm border border-border bg-(--swatch)",
    name: "text-xs truncate text-start font-mono",
  },
});

const styles = primitivesBoard();

const NEUTRALS = STUDIO_PRIMITIVES.filter((primitive) => primitive.name.startsWith("neutral-"));
const BRANDS = STUDIO_PRIMITIVES.filter((primitive) => primitive.name.startsWith("brand-"));

const GROUPS = [
  { title: "Neutral ramp", primitives: NEUTRALS },
  { title: "Brand accents", primitives: BRANDS },
] as const;

/** Copies the primitive's `var()` reference and says so. */
async function copyReference(name: string): Promise<void> {
  const reference = `var(--${name})`;
  try {
    await navigator.clipboard.writeText(reference);
    studioToasts.add({ title: `Copied ${reference}` });
  } catch {
    studioToasts.add({ type: "error", title: `Could not copy ${reference}` });
  }
}

/**
 * The primitives for reference: the neutral ramp and each brand's accent pair, which hold one
 * value in every theme and scheme. A click copies the primitive's `var()`, for a knob's text
 * field or the visitor's own CSS.
 */
export function PrimitivesBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <Text variant="muted">The same in every theme. Select one to copy its var().</Text>
      {GROUPS.map(({ title, primitives }) => (
        <section key={title} className={styles.section()} aria-label={title}>
          <Heading level={2} size="lg">
            {title}
          </Heading>
          <div className={styles.grid()}>
            {primitives.map((primitive) => (
              <Button
                key={primitive.name}
                variant="ghost"
                className={styles.button()}
                aria-label={`Copy var(--${primitive.name})`}
                onClick={() => {
                  void copyReference(primitive.name);
                }}>
                <span aria-hidden className={styles.chip()} style={{ "--swatch": primitive.value }} />
                <span className={styles.name()}>{`--${primitive.name}`}</span>
              </Button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
