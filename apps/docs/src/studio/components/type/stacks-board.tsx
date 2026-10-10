import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Text } from "@elmeragroup/fuse/text";

import { FONT_STACKS, FONT_STACK_LABELS, isFontStack } from "../../lib/font-stacks";

const stacksBoard = tv({
  slots: {
    root: "m-0 flex list-none flex-col p-8",
    entry: "flex flex-col gap-1 border-b border-border py-4 last:border-b-0",
    head: "flex items-baseline justify-between gap-4",
    // Text sets relaxed leading; these keep each size's own.
    name: "leading-(--text-sm--line-height)",
    stack: "font-mono leading-(--text-xs--line-height)",
    // The stack itself, as the knob would write it.
    line: "font-(family-name:--stack) leading-(--text-2xl--line-height)",
  },
});

const styles = stacksBoard();

const STACKS = Object.keys(FONT_STACKS).filter(isFontStack);

/**
 * A line in each font stack the font knobs offer, so a visitor sees each option before picking
 * it. `Body font` is the heading knob's link to `--font-sans`.
 */
export function StacksBoard(): ReactElement {
  return (
    <ul className={styles.root()} aria-label="Font stacks">
      {STACKS.map((stack) => (
        <li key={stack} className={styles.entry()} data-stack={stack}>
          <div className={styles.head()}>
            <Text elementType="span" size="sm" weight="medium" variant="foreground" className={styles.name()}>
              {FONT_STACK_LABELS[stack]}
            </Text>
            <Text elementType="span" size="xs" variant="muted" truncate className={styles.stack()}>
              {FONT_STACKS[stack]}
            </Text>
          </div>
          <Text
            elementType="span"
            size="2xl"
            variant="foreground"
            className={styles.line()}
            style={{ "--stack": FONT_STACKS[stack] }}>
            Sphinx of black quartz, judge my vow. 0123456789
          </Text>
        </li>
      ))}
    </ul>
  );
}
