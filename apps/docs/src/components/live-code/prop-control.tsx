"use client";

import { useId } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Select } from "@elmeragroup/fuse/select";
import { Switch } from "@elmeragroup/fuse/switch";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import type { PropValue } from "../../lib/live-code/edits";
import type { PropSpec } from "../../lib/live-code/schema";
import type { SiteValue } from "../../lib/live-code/store";

const propControl = tv({
  slots: {
    row: "flex min-h-8 items-center justify-between gap-4",
    label: "text-xs inline-flex items-center gap-1.5 font-mono text-muted-foreground",
    // A static dot marks a value the reader changed, so the cue never rests on motion alone.
    dot: "ease-out size-1.5 rounded-full bg-primary transition-opacity duration-150 data-[unchanged]:opacity-0",
    segment:
      "text-xs data-[pressed]:font-medium px-2 text-muted-foreground data-[pressed]:bg-accent data-[pressed]:text-foreground",
    trigger: "text-xs min-w-28",
    item: "text-xs",
    // Says the site's instances render the prop with different values, or that none is known.
    note: "font-sans text-muted-foreground",
    hidden: "sr-only",
  },
});

const { row, label, dot, segment, trigger, item, note, hidden } = propControl();

/** A short list of short options fits a segmented control; anything longer gets a Select. */
function fitsSegments(values: readonly string[]): boolean {
  return values.length <= 4 && values.join("").length <= 24;
}

type PropControlProps = {
  spec: PropSpec;
  /** The options the site can take, for an enum; see `allowedValues`. */
  options: readonly string[];
  /** The value the stage renders the prop with, or `mixed` where the site's instances differ. */
  value: SiteValue;
  /** Whether the reader changed the value. */
  edited: boolean;
  onChange: (value: PropValue | undefined) => void;
};

/**
 * One prop of the tag popover, labelled with its name. A boolean whose value is known is a
 * Switch, and an unknown one is a `true`/`false` segmented control with nothing pressed. An enum
 * is a segmented control for up to four short options and a Select for the rest. A mixed value
 * selects nothing and says so.
 */
export function PropControl({ spec, options, value, edited, onChange }: PropControlProps): ReactElement {
  const labelId = useId();
  const mixed = value.kind === "mixed";
  const current = value.kind === "one" ? value.value : undefined;
  // A boolean whose value is unknown is the two segments `true` and `false`, with neither
  // pressed: nothing passes it and the artifact records no default, so the control claims none.
  const segments =
    spec.kind === "boolean"
      ? current === undefined
        ? ["true", "false"]
        : null
      : fitsSegments(options)
        ? options
        : null;
  const parse = (option: string | undefined): PropValue | undefined =>
    spec.kind === "boolean" && option !== undefined ? option === "true" : option;
  let control: ReactElement;
  if (segments !== null) {
    control = (
      <ToggleGroup.Root
        aria-labelledby={labelId}
        size="xs"
        variant="outline"
        spacing={0}
        value={segments.filter((option) => option === current)}
        onValueChange={(values: string[]) => onChange(parse(values[0]))}>
        {segments.map((option) => (
          <ToggleGroup.Item key={option} value={option} className={segment()}>
            {option}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    );
  } else if (spec.kind === "boolean") {
    control = (
      <Switch
        size="sm"
        aria-labelledby={labelId}
        checked={current === true}
        onCheckedChange={(checked) => onChange(checked)}
      />
    );
  } else {
    control = (
      <Select.Root
        items={Object.fromEntries(options.map((option) => [option, option]))}
        value={options.find((option) => option === current) ?? null}
        onValueChange={(next: string | null) => onChange(next ?? undefined)}>
        <Select.Trigger size="sm" aria-labelledby={labelId} className={trigger()}>
          <Select.Value placeholder={mixed ? "Mixed" : "Unset"} />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option} value={option} className={item()}>
              {option}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    );
  }
  return (
    <div className={row()}>
      <span id={labelId} className={label()}>
        {spec.name}
        {mixed ? <span className={note()}>mixed</span> : null}
        {/* A Select says "Unset" itself; the other controls say it here. */}
        {!mixed && current === undefined && segments !== null ? <span className={note()}>unset</span> : null}
        <span aria-hidden className={dot()} data-unchanged={edited ? undefined : ""} />
        {edited ? <span className={hidden()}>(changed)</span> : null}
      </span>
      {control}
    </div>
  );
}
