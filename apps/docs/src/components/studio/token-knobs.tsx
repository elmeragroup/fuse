"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import type { Srgb } from "@elmeragroup/color/srgb";
import { Button } from "@elmeragroup/fuse/button";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { Popover } from "@elmeragroup/fuse/popover";
import { Select } from "@elmeragroup/fuse/select";
import { Slider } from "@elmeragroup/fuse/slider";
import { TextField } from "@elmeragroup/fuse/text-field";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { STUDIO_PRIMITIVES } from "../../generated/studio-seeds";
import { FONT_STACKS, FONT_STACK_LABELS, isFontStack } from "../../lib/studio/font-stacks";
import { RADIUS_STEPS, aliasTarget, canonicalColorCss, formatLength } from "../../lib/studio/token-values";
import type { ParsedValue } from "../../lib/studio/token-values";
import { STUDIO_TOKEN_NAMES, TOKEN_TABLE, isTokenName } from "../../lib/studio/tokens";
import type { TokenName } from "../../lib/studio/tokens";
import { SingleToggle } from "../single-toggle";
import { useStudioEdits } from "./studio-edits";

const tokenKnobs = tv({
  slots: {
    trigger: "w-full min-w-0 justify-start",
    // Decorative: the color the token resolves to on the edited scheme. The button names it.
    swatch: "size-4 shrink-0 rounded-sm border border-border bg-(--swatch)",
    value: "text-xs min-w-0 truncate font-mono",
    popup: "w-72",
    stack: "flex flex-col gap-3",
    pickerRow: "flex items-center gap-2",
    // The platform picker, the one native control in the studio: Fuse has no color picker.
    picker: "h-8 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5",
    pickerLabel: "text-sm text-muted-foreground",
    swatches: "grid grid-cols-8 gap-1",
    swatchButton: "p-0",
    swatchFill: "size-full rounded-[inherit] bg-(--swatch)",
    groupLabel: "text-xs font-medium text-muted-foreground",
    pair: "flex min-w-0 items-center gap-2",
    slider: "min-w-0 flex-1",
    number: "w-24 shrink-0",
    // The declared CSS can be long, such as a color-mix(); it wraps in the tooltip.
    tooltip: "font-mono break-all",
    select: "w-full",
  },
});

const styles = tokenKnobs();

/** Commits a value. A coalesce key groups one gesture's values into one undo step. */
export type CommitValue = (value: string, coalesce?: string) => void;

/** Reads a value for the knob's token: the CSS to commit, or why the token refuses it. */
export type ParseValue = (text: string) => ParsedValue;

/**
 * One interaction's undo key, from the session, so it never repeats: a remounted knob or a
 * second interaction on the same control gets a new one. `end` closes the interaction, and the
 * next value starts a new undo step.
 */
export function useGesture() {
  const { newGesture } = useStudioEdits();
  const current = useRef<string | undefined>(undefined);
  return {
    key: () => {
      current.current ??= newGesture();
      return current.current;
    },
    end: () => {
      current.current = undefined;
    },
  };
}

/** Ends a text field's typing burst on Enter, as blur does. */
function endOnEnter(end: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      end();
    }
  };
}

/** The keys a number field steps on. */
const STEP_KEYS: ReadonlySet<string> = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/**
 * A number field's undo boundaries. Typing ends on blur or Enter. Each stepper press and each
 * stepping key press is its own interaction, from press to release, so a held stepper or key
 * stays one step and two separate presses make two. The steppers keep the input focused, so
 * blur alone would merge them with each other and with the typing.
 */
export function numberFieldBoundaries(end: () => void) {
  return {
    onBlurCapture: end,
    onPointerDownCapture: end,
    onPointerUpCapture: end,
    onKeyDownCapture: (event: KeyboardEvent) => {
      if (event.key === "Enter" || (STEP_KEYS.has(event.key) && !event.repeat)) {
        end();
      }
    },
    onKeyUpCapture: (event: KeyboardEvent) => {
      if (STEP_KEYS.has(event.key)) {
        end();
      }
    },
  };
}

/**
 * Typed color text in a notation `@elmeragroup/color` reads. A color it reads already, or an
 * alias, stays as typed. Any other color the browser reads, such as `red` or
 * `color(srgb 1 0 0)`, goes through the studio's one canonical path ({@link canonicalColorCss})
 * on a detached probe and comes back as the computed `lab()`. Anything else stays as typed, for
 * the parser to refuse.
 */
function canonicalColor(text: string): string {
  const trimmed = text.trim();
  if (aliasTarget(trimmed) !== undefined || CssColor.parse(trimmed)._tag === "ok") {
    return trimmed;
  }
  const mixed = canonicalColorCss(trimmed);
  // `currentcolor` would resolve against the probe, and a var() against nothing.
  if (/currentcolor|var\(/iu.test(trimmed) || !CSS.supports("color", mixed)) {
    return trimmed;
  }
  const probe = document.createElement("span");
  probe.style.color = mixed;
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed;
}

const TOKEN_VAR = /var\(\s*--[\w-]+\s*\)/gu;

/**
 * A color knob's reading of typed text: the token's parser on the canonical text, then the
 * browser's own grammar check as a second guard on a `color-mix()` the parser accepted. Each
 * `var()` stands in as a color for the check, as it would once resolved.
 */
function readColor(parse: ParseValue, text: string): ParsedValue {
  const parsed = parse(canonicalColor(text));
  return parsed.ok && !CSS.supports("color", parsed.css.replaceAll(TOKEN_VAR, "black"))
    ? { ok: false, reason: "Not a color the browser can read" }
    : parsed;
}

/** Text the visitor typed, with why the token refused it, if it did. */
type Draft = { readonly over: string; readonly text: string; readonly refusal: string | undefined };

/**
 * Text the visitor is typing over a value set elsewhere. The draft shows while the value is the
 * one it left, so a commit that rewrote the typed text, such as a canonical color, keeps the
 * text, and it gives way when the value changes from somewhere else, such as an undo.
 */
function useDraft(value: string) {
  const [draft, setDraft] = useState<Draft | undefined>(undefined);
  const shown = draft?.over === value ? draft : undefined;
  return {
    text: shown?.text ?? value,
    refusal: shown?.refusal,
    /** Records typed text and its reading; an accepted reading becomes the value it shows over. */
    type: (text: string, parsed: ParsedValue | undefined) => {
      setDraft({
        over: parsed?.ok === true ? parsed.css : value,
        text,
        refusal: parsed?.ok === false ? parsed.reason : undefined,
      });
    },
  };
}

const COLOR_TOKENS = STUDIO_TOKEN_NAMES.filter((name) => TOKEN_TABLE[name].kind === "color");

/**
 * A resolved color as `#RRGGBB`, or `#RRGGBBAA` when it is translucent. `@elmeragroup/color`
 * writes the channels; it has no eight-digit form, so the alpha byte is appended here, rounded
 * to the nearest of 256 steps as the channels are.
 */
function hexOf(color: Srgb): string {
  const opaque = Hex.formatOpaque(color);
  const alpha = Math.round(color.alpha * 255);
  return alpha === 255 ? opaque : `${opaque}${alpha.toString(16).padStart(2, "0").toUpperCase()}`;
}

const COLOR_MIX = /^color-mix\(/iu;

/** What a color knob's trigger shows: `→ token` for an alias, `mix` for a mix, else the hex. */
function shortColor(css: string | undefined, color: Srgb | undefined): string {
  if (css === undefined) {
    return "…";
  }
  const target = aliasTarget(css);
  if (target !== undefined) {
    return `→ ${target}`;
  }
  if (COLOR_MIX.test(css)) {
    return "mix";
  }
  return color === undefined ? css : hexOf(color);
}

export type ColorKnobProps = {
  name: TokenName;
  /** The token's CSS in the edited scheme, `undefined` while the base theme loads. */
  css: string | undefined;
  /** The color it resolves to there, once read. */
  color: Srgb | undefined;
  /** Reads a value for this token, refusing an unknown token, another kind or a cycle. */
  parse: ParseValue;
  onCommit: CommitValue;
};

/**
 * A color token's knob: a button showing the color as a short value, with the declared CSS as
 * its tooltip, opening a popover with a text field for any CSS color, the platform color picker,
 * the primitives as swatches and a link to another token. Typing is one undo step per burst, and
 * the picker one per popover session.
 */
export function ColorKnob({ name, css, color, parse, onCommit }: ColorKnobProps): ReactElement {
  const draft = useDraft(css ?? "");
  const typing = useGesture();
  const picking = useGesture();
  const target = css === undefined ? undefined : aliasTarget(css);
  const linked = target !== undefined && isTokenName(target) ? target : null;
  const linkItems = Object.fromEntries(
    COLOR_TOKENS.filter((token) => token !== name).map((token) => [token, `--${token}`])
  );
  const swatch = color === undefined ? undefined : hexOf(color);

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) {
          typing.end();
          picking.end();
        }
      }}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={styles.trigger()}
                  aria-label={`Edit --${name}`}
                />
              }
            />
          }>
          <span aria-hidden className={styles.swatch()} style={{ "--swatch": swatch }} />
          <span className={styles.value()}>{shortColor(css, color)}</span>
        </Tooltip.Trigger>
        {css === undefined ? null : <Tooltip.Content className={styles.tooltip()}>{css}</Tooltip.Content>}
      </Tooltip.Root>
      <Popover.Content className={styles.popup()} align="end">
        <Popover.Header>
          <Popover.Title>{`--${name}`}</Popover.Title>
        </Popover.Header>
        <div className={styles.stack()}>
          {/* The typing burst's boundary: blur or Enter ends one undo step. */}
          <div onBlurCapture={typing.end} onKeyDownCapture={endOnEnter(typing.end)}>
            <TextField
              label="Color"
              description="Any CSS color, or an alias such as var(--border)"
              value={draft.text}
              isInvalid={draft.refusal !== undefined}
              errorMessage={draft.refusal}
              onChange={(text) => {
                const parsed = text.trim() === "" ? undefined : readColor(parse, text);
                draft.type(text, parsed);
                if (parsed?.ok === true) {
                  onCommit(parsed.css, typing.key());
                }
              }}
            />
          </div>
          <label className={styles.pickerRow()}>
            <input
              type="color"
              className={styles.picker()}
              value={color === undefined ? "#000000" : Hex.formatOpaque(color).toLowerCase()}
              onChange={(event) => {
                onCommit(event.target.value.toUpperCase(), picking.key());
              }}
            />
            <span className={styles.pickerLabel()}>Pick a color</span>
          </label>
          <div className={styles.stack()} role="group" aria-label="Primitives">
            <span aria-hidden className={styles.groupLabel()}>
              Primitives
            </span>
            <div className={styles.swatches()}>
              {STUDIO_PRIMITIVES.map((primitive) => (
                <Button
                  key={primitive.name}
                  variant="outline"
                  size="icon-xs"
                  className={styles.swatchButton()}
                  aria-label={`--${primitive.name}`}
                  aria-pressed={target === primitive.name}
                  onClick={() => {
                    onCommit(`var(--${primitive.name})`);
                  }}>
                  <span aria-hidden className={styles.swatchFill()} style={{ "--swatch": primitive.value }} />
                </Button>
              ))}
            </div>
          </div>
          <Select.Root
            items={linkItems}
            value={linked}
            onValueChange={(token) => {
              const parsed = token === null ? undefined : parse(`var(--${token})`);
              if (parsed?.ok === true) {
                onCommit(parsed.css);
              }
            }}>
            <Select.Trigger size="sm" className={styles.select()} aria-label="Link to token">
              <Select.Value placeholder="Link to token" />
            </Select.Trigger>
            <Select.Content alignItemWithTrigger={false}>
              {Object.entries(linkItems).map(([value, label]) => (
                // A target that would close a cycle is disabled, not hidden, so the list keeps
                // the contract's order.
                <Select.Item key={value} value={value} disabled={!parse(`var(--${value})`).ok}>
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

export type NumberKnobProps = {
  name: TokenName;
  /** The value in effect, `undefined` while the base theme loads. */
  value: number | undefined;
  min: number;
  max: number;
  step: number;
  /** What the number field names the unit, such as `px`. */
  unit?: string;
  /** The CSS the knob writes for a value. */
  format: (value: number) => string;
  /** Reads a value for this token. */
  parse: ParseValue;
  onCommit: CommitValue;
};

/**
 * A numeric token's knob: the Fuse Slider paired with a NumberField. A slider drag or a held key
 * is one undo step, ending on pointer-up or key-up. In the field, a typing burst ends on blur or
 * Enter, and each stepper or arrow key press is its own step.
 */
export function NumberKnob({
  name,
  value,
  min,
  max,
  step,
  unit,
  format,
  parse,
  onCommit,
}: NumberKnobProps): ReactElement {
  const sliding = useGesture();
  const field = useGesture();
  const commit = (next: number, coalesce: string) => {
    const parsed = parse(format(next));
    if (parsed.ok) {
      onCommit(parsed.css, coalesce);
    }
  };
  return (
    <div className={styles.pair()}>
      {/* Layout, and the slider gesture's boundary: a press starts one, a release ends it. */}
      <div
        className={styles.slider()}
        onPointerDownCapture={sliding.end}
        onPointerUpCapture={sliding.end}
        onKeyUpCapture={sliding.end}
        onBlurCapture={sliding.end}>
        <Slider
          aria-label={`--${name}`}
          value={value ?? min}
          minValue={min}
          maxValue={max}
          step={step}
          isDisabled={value === undefined}
          onChange={(next) => {
            commit(next, sliding.key());
          }}
        />
      </div>
      {/* Layout, and the field's undo boundaries: a typing burst, a stepper press or a key press. */}
      <div className={styles.number()} {...numberFieldBoundaries(field.end)}>
        <NumberField
          aria-label={unit === undefined ? `--${name} value` : `--${name} in ${unit}`}
          // NaN, the controlled empty state, keeps the field controlled until the seed loads.
          value={value ?? Number.NaN}
          minValue={min}
          maxValue={max}
          step={step}
          isDisabled={value === undefined}
          onChange={(next) => {
            if (!Number.isNaN(next)) {
              commit(next, field.key());
            }
          }}
        />
      </div>
    </div>
  );
}

/** The length knob's range and the unit it writes, per length token. */
export const LENGTH_KNOBS = {
  radius: { max: 40, step: 1, unit: "rem" },
  "radius-button": { max: 40, step: 1, unit: "rem" },
  "radius-field": { max: 40, step: 1, unit: "rem" },
  "button-outline-width": { max: 4, step: 0.5, unit: "px" },
} as const satisfies Partial<Record<TokenName, { max: number; step: number; unit: "px" | "rem" }>>;

export type LengthToken = keyof typeof LENGTH_KNOBS;

export function isLengthToken(name: TokenName): name is LengthToken {
  return Object.hasOwn(LENGTH_KNOBS, name);
}

/** A length token's knob, in px, writing rem or px as the token's base value does. */
export function LengthKnob({
  name,
  px,
  parse,
  onCommit,
}: {
  name: LengthToken;
  px: number | undefined;
  parse: ParseValue;
  onCommit: CommitValue;
}): ReactElement {
  const { max, step, unit } = LENGTH_KNOBS[name];
  return (
    <NumberKnob
      name={name}
      value={px}
      min={0}
      max={max}
      step={step}
      unit="px"
      format={(value) => formatLength(value, unit)}
      parse={parse}
      onCommit={onCommit}
    />
  );
}

const RADIUS_STEP_LABELS = { "0px": "0px · internal", "2px": "2px · external" } as const;

/** `--radius-step` takes only the two values the corner formulas support, so its knob toggles. */
export function RadiusStepKnob({
  css,
  onCommit,
}: {
  css: string | undefined;
  onCommit: CommitValue;
}): ReactElement {
  const value = RADIUS_STEPS.find((step) => step === css) ?? "0px";
  return (
    <SingleToggle
      label="--radius-step"
      size="sm"
      options={RADIUS_STEPS}
      labels={RADIUS_STEP_LABELS}
      value={value}
      onValueChange={(step) => {
        onCommit(step);
      }}
    />
  );
}

/** A font family token's knob: a Select of stacks, and the stack as free text. */
export function FontKnob({
  name,
  css,
  parse,
  onCommit,
}: {
  name: TokenName;
  css: string | undefined;
  /** Reads a value for this token. */
  parse: ParseValue;
  onCommit: CommitValue;
}): ReactElement {
  const draft = useDraft(css ?? "");
  const typing = useGesture();
  const stacks = Object.fromEntries(
    Object.entries(FONT_STACK_LABELS).filter(([key]) => name === "font-heading" || key !== "body")
  );
  const picked = Object.keys(stacks).find((key) => isFontStack(key) && FONT_STACKS[key] === css) ?? null;
  return (
    <div className={styles.stack()}>
      <Select.Root
        items={stacks}
        value={picked}
        onValueChange={(key) => {
          const parsed = isFontStack(key) ? parse(FONT_STACKS[key]) : undefined;
          if (parsed?.ok === true) {
            onCommit(parsed.css);
          }
        }}>
        <Select.Trigger size="sm" className={styles.select()} aria-label={`--${name} stack`}>
          <Select.Value placeholder="Custom stack" />
        </Select.Trigger>
        <Select.Content alignItemWithTrigger={false}>
          {Object.entries(stacks).map(([key, label]) => (
            <Select.Item key={key} value={key}>
              {label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {/* The typing burst's boundary: blur or Enter ends one undo step. */}
      <div onBlurCapture={typing.end} onKeyDownCapture={endOnEnter(typing.end)}>
        <TextField
          aria-label={`--${name}`}
          value={draft.text}
          isInvalid={draft.refusal !== undefined}
          errorMessage={draft.refusal}
          onChange={(text) => {
            const parsed = parse(text);
            draft.type(text, parsed);
            if (parsed.ok) {
              onCommit(parsed.css, typing.key());
            }
          }}
        />
      </div>
    </div>
  );
}
