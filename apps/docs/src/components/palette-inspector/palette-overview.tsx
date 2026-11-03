"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { PALETTE_GROUPS } from "../../lib/palettes";
import type { PairView, PaletteView, RoleView, ToneView } from "../../lib/palettes";
import { GradeBadge, isCopied, Swatch, ToneReadout } from "./color-readout";
import type { CopyFeedback } from "./color-readout";
import { triggerSide } from "./tooltip-placement";
import type { CellSide } from "./tooltip-placement";

const paletteOverview = tv({
  slots: {
    root: "@container flex flex-col gap-6",
    section: "flex flex-col gap-2",
    heading: "text-sm font-semibold flex items-baseline gap-2 text-foreground",
    count: "text-xs font-normal text-muted-foreground tabular-nums",
    lede: "text-xs text-pretty text-muted-foreground",
    // The grid's gap is declared once, and each swatch's hit area derives from it.
    tones:
      "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-(--tones-gap) p-0 [--tones-gap:--spacing(1)]",
    // A tone is its own swatch. The active ring marks the tone a role in focus resolves to.
    // A translucent tone has a dashed edge, since it paints as whatever it lies on. Its hit area,
    // the `::before`, reaches half the gap past the swatch's border on every side: the pseudo
    // element is placed from the padding box, so the border width adds to half the gap. The hit
    // areas of neighbouring swatches meet at any root font size, so a pointer crossing the strip
    // never rests outside a trigger. The swatch, its ring and its focus ring stay on the visible box.
    tone: "relative block h-7 w-full rounded-sm border-(length:--tone-edge) border-foreground/15 bg-(--swatch) outline-offset-2 [--tone-edge:1px] before:absolute before:-inset-[calc(var(--tones-gap)/2_+_var(--tone-edge))] data-translucent:border-dashed data-translucent:border-foreground/40 data-active:ring-2 data-active:ring-ring data-active:ring-offset-2 data-active:ring-offset-background",
    groups: "flex flex-col gap-4",
    groupHeading: "text-xs font-medium text-muted-foreground",
    roles:
      "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-(--roles-gap-x) gap-y-(--roles-gap-y) p-0 [--roles-gap-x:--spacing(2)] [--roles-gap-y:--spacing(0.5)]",
    // While a tone or role is in focus, the roles on other tones fade, so the roles that share it
    // stand out. Opacity only, and none under reduced motion.
    // Its hit area reaches half of each of the grid's gaps, so the hit areas of neighbouring
    // roles meet. A role has no border, so the halves alone reach the middle of the gap.
    role: "text-xs ease-out relative flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-start transition-opacity duration-150 before:absolute before:-inset-x-[calc(var(--roles-gap-x)/2)] before:-inset-y-[calc(var(--roles-gap-y)/2)] hover:bg-accent hover:text-accent-foreground data-dimmed:opacity-35 motion-reduce:transition-none",
    roleName: "truncate font-mono",
    shared: "text-xs flex flex-col gap-0.5",
    sharedList: "flex flex-wrap gap-x-2 font-mono",
    sharedRole: "whitespace-nowrap",
    pairs: "@2xl:grid-cols-2 grid gap-x-6 gap-y-1",
    pairGroup: "flex flex-col gap-1.5",
    pair: "text-xs flex min-h-7 items-center gap-2.5",
    // The pair itself: the background role's fill lettered in the foreground role, as the studio's
    // pair tile paints it, so a pair below AA reads as hard to read here too.
    sample:
      "text-xs font-semibold flex h-6 w-9 flex-none items-center justify-center rounded-sm border border-foreground/15 bg-(--pair-bg) text-(--pair-fg)",
    pairNames: "min-w-0 flex-1 font-mono text-pretty",
    pairOn: "font-sans text-muted-foreground",
  },
});

const styles = paletteOverview();

type FocusProps = {
  /** The step of the tone in focus, if any. */
  activeStep: number | undefined;
  onFocusStep: (step: number | undefined) => void;
  copy: CopyFeedback;
};

/** The pointer and focus handlers that put a tone in focus while its trigger is. */
function focusHandlers(step: number, onFocusStep: FocusProps["onFocusStep"]) {
  return {
    onPointerEnter: () => onFocusStep(step),
    onPointerLeave: () => onFocusStep(undefined),
    onFocus: () => onFocusStep(step),
    onBlur: () => onFocusStep(undefined),
  };
}

/** The roles that resolve to a tone, written as custom properties. */
function SharedBy({ roles }: { roles: readonly string[] }): ReactElement {
  return (
    <span className={styles.shared()}>
      <span>{roles.length === 1 ? "Used by one role" : `Shared by ${String(roles.length)} roles`}</span>
      <span className={styles.sharedList()}>
        {roles.map((role) => (
          <span key={role} className={styles.sharedRole()}>
            --{role}
          </span>
        ))}
      </span>
    </span>
  );
}

function ToneSwatch({ tone, activeStep, onFocusStep, copy }: FocusProps & { tone: ToneView }): ReactElement {
  const key = `tone-${String(tone.step)}`;
  return (
    <li>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={<button type="button" />}
          className={styles.tone()}
          style={{ "--swatch": tone.oklch }}
          aria-label={`Tone ${String(tone.step)}, ${tone.hex}`}
          data-active={activeStep === tone.step ? "" : undefined}
          data-translucent={tone.alpha < 1 ? "" : undefined}
          onClick={() => copy.copy(key, tone.oklch)}
          {...focusHandlers(tone.step, onFocusStep)}>
          {null}
        </Tooltip.Trigger>
        <Tooltip.Content>
          <ToneReadout title={`Tone ${String(tone.step)}`} tone={tone} copied={isCopied(copy, key)}>
            <SharedBy roles={tone.roles} />
          </ToneReadout>
        </Tooltip.Content>
      </Tooltip.Root>
    </li>
  );
}

/**
 * The tones strip. Each swatch has its own tooltip, which opens on top: the strip is a few rows of
 * small swatches scanned along a row, which a tooltip above leaves in view. The strip's provider
 * opens every tooltip at once, and its skip-delay hand-off opens a neighbour's as the last closes.
 */
function ToneGrid({ tones, ...focus }: FocusProps & { tones: readonly ToneView[] }): ReactElement {
  return (
    <Tooltip.Provider delay={0}>
      <ul className={styles.tones()}>
        {tones.map((tone) => (
          <ToneSwatch key={tone.step} tone={tone} {...focus} />
        ))}
      </ul>
    </Tooltip.Provider>
  );
}

/**
 * A role and its tooltip. The tooltip opens away from the neighbours a pointer moves to next: to
 * the left in the first column, to the right in the last, and on top in between or in a single
 * column. The side is read from the layout as the tooltip opens.
 */
function RoleSwatch({ role, activeStep, onFocusStep, copy }: FocusProps & { role: RoleView }): ReactElement {
  const key = `role-${role.name}`;
  const [side, setSide] = useState<CellSide>("top");
  const dimmed = activeStep !== undefined && activeStep !== role.tone.step;
  const focus = focusHandlers(role.tone.step, onFocusStep);
  return (
    <li data-tooltip-cell>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={<button type="button" />}
          className={styles.role()}
          data-dimmed={dimmed ? "" : undefined}
          data-palette-role={role.name}
          onClick={() => copy.copy(key, role.tone.oklch)}
          {...focus}
          onPointerEnter={(event) => {
            setSide(triggerSide(event.currentTarget));
            focus.onPointerEnter();
          }}
          onFocus={(event) => {
            setSide(triggerSide(event.currentTarget));
            focus.onFocus();
          }}>
          <Swatch tone={role.tone} />
          <span className={styles.roleName()}>--{role.name}</span>
        </Tooltip.Trigger>
        <Tooltip.Content side={side}>
          <ToneReadout title={`--${role.name}`} tone={role.tone} copied={isCopied(copy, key)}>
            {role.alias === undefined ? null : <span>Declared as var({role.alias})</span>}
            {role.sharesWith.length === 0 ? null : <SharedBy roles={[role.name, ...role.sharesWith]} />}
          </ToneReadout>
        </Tooltip.Content>
      </Tooltip.Root>
    </li>
  );
}

/** Every color role by group, under one provider, so moving between roles skips the delay. */
function RoleGroups({ roles, ...focus }: FocusProps & { roles: readonly RoleView[] }): ReactElement {
  return (
    <Tooltip.Provider delay={0}>
      <div className={styles.groups()}>
        {PALETTE_GROUPS.map((group) => (
          <section key={group.id} aria-label={group.label} className={styles.section()}>
            <h4 className={styles.groupHeading()}>{group.label}</h4>
            <ul className={styles.roles()} data-tooltip-grid>
              {roles
                .filter((role) => role.group === group.id)
                .map((role) => (
                  <RoleSwatch key={role.name} role={role} {...focus} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </Tooltip.Provider>
  );
}

function PairRow({ pair }: { pair: PairView }): ReactElement {
  return (
    <li className={styles.pair()} data-palette-pair={`${pair.foreground}/${pair.background}`}>
      <span
        aria-hidden
        className={styles.sample()}
        data-pair-sample
        style={{ "--pair-fg": pair.foregroundTone.oklch, "--pair-bg": pair.backgroundTone.oklch }}>
        Aa
      </span>
      <span className={styles.pairNames()}>
        --{pair.foreground} <span className={styles.pairOn()}>on</span> --{pair.background}
      </span>
      <GradeBadge grade={pair.grade} ratio={pair.ratio} />
    </li>
  );
}

const PAIR_GROUPS = [
  {
    kind: "text-grade",
    title: "Text-grade pairs",
    lede: "Fuse's contrast gate holds these at 4.5:1 in every theme and scheme.",
  },
  {
    kind: "role",
    title: "Other role pairs",
    lede: "A role and the foreground drawn on it, with no floor: brand marks, decorative fills and panels.",
  },
] as const;

/**
 * The inspector's Default view: the theme's tones darkest first, every color role by group, and
 * every graded pair. A tone or role in focus fades the roles on other tones, and its tooltip
 * gives the value as OKLCH and hex. A click copies the OKLCH value.
 */
export function PaletteOverview({ view, copy }: { view: PaletteView; copy: CopyFeedback }): ReactElement {
  const [activeStep, setActiveStep] = useState<number | undefined>(undefined);
  const focus = { activeStep, onFocusStep: setActiveStep, copy };
  return (
    <div className={styles.root()}>
      <section className={styles.section()} aria-labelledby="palette-tones">
        <h3 id="palette-tones" className={styles.heading()}>
          Tones <span className={styles.count()}>{view.tones.length}</span>
        </h3>
        <p className={styles.lede()}>
          Every distinct color the roles resolve to, darkest first. Translucent tones follow, with a dashed
          edge. Point at a tone or a role to see the roles that share it.
        </p>
        <ToneGrid tones={view.tones} {...focus} />
      </section>
      <section className={styles.section()} aria-labelledby="palette-roles">
        <h3 id="palette-roles" className={styles.heading()}>
          Roles <span className={styles.count()}>{view.roles.length}</span>
        </h3>
        <RoleGroups roles={view.roles} {...focus} />
      </section>
      <section className={styles.section()} aria-labelledby="palette-contrast">
        <h3 id="palette-contrast" className={styles.heading()}>
          Contrast <span className={styles.count()}>{view.pairs.length}</span>
        </h3>
        <div className={styles.pairs()}>
          {PAIR_GROUPS.map((group) => (
            <section key={group.kind} aria-label={group.title} className={styles.pairGroup()}>
              <h4 className={styles.groupHeading()}>{group.title}</h4>
              <p className={styles.lede()}>{group.lede}</p>
              <ul className={styles.pairGroup()}>
                {view.pairs
                  .filter((pair) => pair.kind === group.kind)
                  .map((pair) => (
                    <PairRow key={`${pair.foreground}/${pair.background}`} pair={pair} />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
