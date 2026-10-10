"use client";

import { useCallback, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Heading } from "@elmeragroup/fuse/heading";
import { MagnifyingGlass, Star } from "@elmeragroup/fuse/icons";
import { Select } from "@elmeragroup/fuse/select";
import { Table } from "@elmeragroup/fuse/table";
import { Text } from "@elmeragroup/fuse/text";
import { Toggle } from "@elmeragroup/fuse/toggle";

import { formatPx } from "../../lib/measure";

const ladderBoard = tv({
  slots: {
    root: "flex flex-col gap-4 p-8",
    cell: "flex flex-col items-start gap-1",
    height: "font-mono tabular-nums",
  },
});

const styles = ladderBoard();

const SIZES = ["xs", "sm", "md", "lg"] as const;

type Size = (typeof SIZES)[number];

/** Each control size as the size prop of Button's label and square fits, and of Toggle. */
const BUTTON_SIZE = { xs: "xs", sm: "sm", md: "default", lg: "lg" } as const satisfies Record<Size, string>;
const ICON_SIZE = { xs: "icon-xs", sm: "icon-sm", md: "icon", lg: "icon-lg" } as const satisfies Record<
  Size,
  string
>;
const TOGGLE_SIZE = { xs: "xs", sm: "sm", md: "default", lg: "lg" } as const satisfies Record<Size, string>;
/** Select's trigger, the field with a size axis, has only the sm and md sizes. */
const SELECT_SIZE = { sm: "sm", md: "default" } as const satisfies Partial<Record<Size, string>>;

const ITEMS = { monthly: "Monthly", yearly: "Yearly" } as const;

/**
 * A control with its computed height below it. The height is the control's border box in CSS px,
 * which a ResizeObserver reports untouched by the canvas zoom.
 */
function Measured({ children }: { children: ReactNode }): ReactElement {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const observe = useCallback((element: HTMLDivElement | null) => {
    const control = element?.firstElementChild;
    if (control === null || control === undefined) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const size = entry?.borderBoxSize[0];
      if (size !== undefined) {
        setHeight(size.blockSize);
      }
    });
    observer.observe(control);
    return () => {
      observer.disconnect();
    };
  }, []);
  return (
    // Layout only: the control, then its height.
    <div ref={observe} className={styles.cell()}>
      {children}
      <Text size="xs" variant="muted" className={styles.height()} data-ladder-height>
        {height === undefined ? "—" : `${formatPx(height)}px`}
      </Text>
    </div>
  );
}

function SelectAt({ size }: { size: "sm" | "default" }): ReactElement {
  return (
    <Select.Root items={ITEMS} defaultValue="monthly">
      <Select.Trigger size={size} aria-label="Billing period">
        <Select.Value />
      </Select.Trigger>
      <Select.Content alignItemWithTrigger={false}>
        {Object.entries(ITEMS).map(([value, label]) => (
          <Select.Item key={value} value={value}>
            {label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

/**
 * The control size ladder: Buttons, a Toggle and a Select at each control size, in the fits
 * `label`, `min-square` and `square`, each with its computed height. The page renders it once
 * per density.
 */
export function LadderBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <Heading level={3} size="sm">
        Control sizes
      </Heading>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Size</Table.Head>
            <Table.Head>Button · label</Table.Head>
            <Table.Head>Toggle · min-square</Table.Head>
            <Table.Head>Button · square</Table.Head>
            <Table.Head>Select · label</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {SIZES.map((size) => {
            const select = size === "sm" || size === "md" ? SELECT_SIZE[size] : undefined;
            return (
              <Table.Row key={size} data-ladder-size={size}>
                <Table.Cell>{size}</Table.Cell>
                <Table.Cell>
                  <Measured>
                    <Button size={BUTTON_SIZE[size]} variant="outline">
                      Continue
                    </Button>
                  </Measured>
                </Table.Cell>
                <Table.Cell>
                  <Measured>
                    <Toggle size={TOGGLE_SIZE[size]} variant="outline" aria-label={`Favourite, ${size}`}>
                      <Star />
                    </Toggle>
                  </Measured>
                </Table.Cell>
                <Table.Cell>
                  <Measured>
                    <Button size={ICON_SIZE[size]} variant="outline" aria-label={`Search, ${size}`}>
                      <MagnifyingGlass />
                    </Button>
                  </Measured>
                </Table.Cell>
                <Table.Cell>
                  {select === undefined ? (
                    <Text size="xs" variant="muted">
                      No {size} size
                    </Text>
                  ) : (
                    <Measured>
                      <SelectAt size={select} />
                    </Measured>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
}
