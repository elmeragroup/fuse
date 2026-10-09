import type { ComponentProps, ReactElement, ReactNode } from "react";

import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

type ToggleRootProps = ComponentProps<typeof ToggleGroup.Root>;
type ToggleItemProps = Omit<ComponentProps<typeof ToggleGroup.Item>, "value" | "children">;

export type SingleToggleProps<Option extends string> = Omit<
  ToggleRootProps,
  "value" | "defaultValue" | "onValueChange" | "children" | "aria-label"
> & {
  label: string;
  options: readonly Option[];
  labels: Readonly<Record<Option, ReactNode>>;
  value: Option;
  onValueChange: (next: Option) => void;
  /** Props for one option's button, such as a handler that only that option needs. */
  optionProps?: { readonly [Key in Option]?: ToggleItemProps };
};

/** An outline toggle row where exactly one option is on; pressing the active one keeps it. */
export function SingleToggle<Option extends string>({
  label,
  options,
  labels,
  value,
  onValueChange,
  optionProps,
  ...props
}: SingleToggleProps<Option>): ReactElement {
  return (
    <ToggleGroup.Root
      aria-label={label}
      variant="outline"
      spacing={0}
      {...props}
      value={[value]}
      onValueChange={(next) => {
        const picked = options.find((option) => option === next[0]);
        if (picked !== undefined) {
          onValueChange(picked);
        }
      }}>
      {options.map((option) => (
        <ToggleGroup.Item key={option} value={option} {...optionProps?.[option]}>
          {labels[option]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
