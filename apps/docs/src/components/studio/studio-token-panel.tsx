"use client";

import {
  Fragment,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

import { createPortal } from "react-dom";
import { tv } from "tailwind-variants";

import * as CssColor from "@elmeragroup/color/css-color";
import type { Srgb } from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";
import { Accordion } from "@elmeragroup/fuse/accordion";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { ArrowsClockwise, Dot, MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { TextField } from "@elmeragroup/fuse/text-field";
import { ThemeScope } from "@elmeragroup/fuse/theme";
import { Toggle } from "@elmeragroup/fuse/toggle";

import type { ArtboardScheme } from "../../lib/studio/documents";
import { editedCount, overrideOf } from "../../lib/studio/edits";
import {
  aliasTarget,
  canonicalColorCss,
  createsCycle,
  createsPinnedCycle,
  currentCss,
  lengthPx,
  parseTokenValue,
  resolvedCss,
} from "../../lib/studio/token-values";
import type { ParsedValue } from "../../lib/studio/token-values";
import {
  STUDIO_SECTIONS,
  STUDIO_TOKEN_NAMES,
  TOKEN_TABLE,
  isTokenName,
  pairOfForeground,
  sectionTokens,
} from "../../lib/studio/tokens";
import type { SectionId, TokenName } from "../../lib/studio/tokens";
import { SingleToggle } from "../single-toggle";
import type { ArtboardScope } from "./studio-artboard";
import { useStudioEdits } from "./studio-edits";
import { StudioPanelSection } from "./studio-panel-section";
import { useStudio } from "./studio-state";
import { useTokenFocus } from "./studio-token-focus";
import type { TokenFocusRequest } from "./studio-token-focus";
import { ColorKnob, FontKnob, LengthKnob, NumberKnob, RadiusStepKnob, isLengthToken } from "./token-knobs";
import type { CommitValue, ParseValue } from "./token-knobs";

const studioTokenPanel = tv({
  slots: {
    panel: "contain-inline-size",
    controls: "flex flex-col gap-2 px-2",
    filters: "flex items-center gap-2",
    search: "min-w-0 flex-1",
    sections: "px-0",
    // The trigger is one text line tall, under the 24px target floor in the dense chrome.
    trigger: "text-sm min-h-6 gap-2",
    count: "ml-auto",
    content: "flex flex-col gap-3 px-2 pb-2",
    sectionReset: "self-end",
    row: "group/row flex min-w-0 flex-col gap-1.5",
    // The name keeps its whole width; the marks wrap below it when the row runs out of room.
    rowHead: "flex min-h-6 min-w-0 flex-wrap items-center gap-1",
    name: "text-xs min-w-0 font-mono break-all",
    mark: "shrink-0",
    edited: "size-4 shrink-0 text-primary",
    chip: "shrink-0 font-mono",
    reset:
      "ml-auto shrink-0 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
    empty: "text-sm px-2 text-muted-foreground",
    probeToken: "text-(--probe)",
  },
});

const styles = studioTokenPanel();

const SCHEMES = ["light", "dark"] as const satisfies readonly ArtboardScheme[];

const SCHEME_LABELS = { light: "Light", dark: "Dark" } as const satisfies Record<ArtboardScheme, string>;

const COLOR_TOKENS = STUDIO_TOKEN_NAMES.filter((name) => TOKEN_TABLE[name].kind === "color");

/** The platform never changes whether it is a client, so there is nothing to subscribe to. */
const subscribeNever = (): (() => void) => () => undefined;

/** A color token as the browser resolves it: in sRGB, and as the canonical `lab()` it computed. */
type ResolvedColor = { readonly srgb: Srgb; readonly css: string };

/**
 * Every color token as the browser resolves it in `scheme`, read off a hidden probe: a theme
 * scope in the base theme, or in the given artboard scope, and that scheme, wearing the
 * scheme's edits or the scope's declarations. The probe is portalled to the body, outside the
 * chrome, whose dark rules would reach a nested scope. Each color token routes through `color`
 * on its own child by the studio's canonical path, so the browser serializes it as `lab()`,
 * which `@elmeragroup/color` reads whatever notation the token holds, and one style pass
 * resolves them all.
 *
 * @param scope - The theme and declarations to probe, such as an artboard's pinned variant;
 *   omitted, the base theme wearing the scheme's edits.
 */
export function useResolvedColors(scheme: ArtboardScheme, scope?: ArtboardScope) {
  const studio = useStudio();
  const { styleFor, seed } = useStudioEdits();
  const theme = scope?.theme ?? studio.theme;
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const probeRef = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<ReadonlyMap<TokenName, ResolvedColor>>(new Map());
  // oxlint-disable-next-line shadcn/no-inline-styles -- token edits: custom properties only (artboardStyle), the scope's or the scheme's
  const style = scope?.style ?? styleFor(scheme);
  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (probe === null) {
      return;
    }
    const resolved = new Map<TokenName, ResolvedColor>();
    for (const element of probe.querySelectorAll<HTMLElement>("[data-token]")) {
      const name = element.dataset.token ?? "";
      const css = getComputedStyle(element).color;
      const parsed = CssColor.parse(css);
      if (isTokenName(name) && parsed._tag === "ok") {
        resolved.set(name, { srgb: CssColor.toSrgb(parsed.value), css });
      }
    }
    setColors(resolved);
  }, [isClient, scheme, theme, style, seed]);

  const probe = isClient
    ? createPortal(
        <ThemeScope
          ref={probeRef}
          theme={theme}
          data-theme={scheme}
          // oxlint-disable-next-line shadcn/no-inline-styles -- token edits: custom properties only (artboardStyle), as an artboard in this scheme wears them
          style={style}
          hidden
          aria-hidden>
          {COLOR_TOKENS.map((name) => (
            <span
              key={name}
              data-token={name}
              className={styles.probeToken()}
              style={{ "--probe": canonicalColorCss(`var(--${name})`) }}
            />
          ))}
        </ThemeScope>,
        document.body
      )
    : null;
  return { colors, probe };
}

/** WCAG AA for body text. */
const AA_RATIO = 4.5;

/**
 * The foreground row's mark: its pair's contrast ratio and whether it meets AA, or that the
 * surface is translucent. A role surface can sit on any other surface, so the studio does not
 * pick one backdrop to composite it over and report that one case as the pair's contrast.
 */
function ContrastMark({ contrast }: { contrast: Contrast }): ReactElement {
  if (contrast === "translucent") {
    return (
      <Badge size="sm" className={styles.mark()} variant="outline-warning" data-contrast="translucent">
        Needs an opaque backdrop
      </Badge>
    );
  }
  const passes = contrast >= AA_RATIO;
  return (
    <Badge
      size="sm"
      className={styles.mark()}
      variant={passes ? "outline-success" : "outline-destructive"}
      data-contrast={passes ? "pass" : "fail"}>
      {`${passes ? "AA" : "Fail"} ${contrast.toFixed(2)}:1`}
    </Badge>
  );
}

/** A pair's WCAG ratio, or `translucent` when the surface is not opaque. */
type Contrast = number | "translucent";

function contrastOf(name: TokenName, colors: ReadonlyMap<TokenName, ResolvedColor>): Contrast | undefined {
  const pair = pairOfForeground(name);
  const foreground = pair === undefined ? undefined : colors.get(pair.foreground);
  const surface = pair === undefined ? undefined : colors.get(pair.surface);
  if (foreground === undefined || surface === undefined) {
    return undefined;
  }
  const ratio = Wcag.contrastRatio(foreground.srgb, surface.srgb);
  return ratio._tag === "ok" ? ratio.value : "translucent";
}

export type TokenRowProps = {
  name: TokenName;
  colors: ReadonlyMap<TokenName, ResolvedColor>;
  /**
   * The artboard scope the row describes, in its scheme and with the declarations it wears, such
   * as a pinned variant's; omitted, the base theme in the edited scheme. An edit applies to that
   * scheme on every artboard, so it is checked against the base theme and every pinned variant.
   */
  scope?: ArtboardScope;
};

/**
 * One token: its name, marks and reset, then its knob. The Selection section lists these too,
 * for the scope of the artboard a part sits in.
 */
export function TokenRow({ name, colors, scope }: TokenRowProps): ReactElement {
  const { overrides, seed, pins, edit, editScheme } = useStudioEdits();
  const { theme } = useStudio();
  const scheme = scope?.scheme ?? editScheme;
  // What the row describes: the declarations the scope wears, else the base theme's with the edits.
  const shown = scope ?? { overrides, seed };
  const css = currentCss(shown.overrides, shown.seed, scheme, name);
  const edited = overrideOf(overrides, scheme, name) !== undefined;
  const target = css === undefined ? undefined : aliasTarget(css);
  const color = colors.get(name);
  const contrast = contrastOf(name, colors);
  const kind = TOKEN_TABLE[name].kind;

  // The one reading of a value for this row: its kind's parser, then the cycle check against
  // the base theme, the variants the page pins and the edits in effect.
  const parse: ParseValue = (text): ParsedValue => {
    const parsed = parseTokenValue(name, text);
    return parsed.ok &&
      (createsCycle(overrides, seed, scheme, name, parsed.css) ||
        createsPinnedCycle(overrides, theme, pins, scheme, name, parsed.css))
      ? { ok: false, reason: `Links --${name} back to itself` }
      : parsed;
  };

  const commit: CommitValue = (value, coalesce) => {
    edit({ type: "set", scheme, name, value, coalesce });
  };
  // A color detaches to the color it resolves to, alpha included, in the canonical lab().
  const detachedCss = kind === "color" ? color?.css : resolvedCss(shown.overrides, shown.seed, scheme, name);
  const detachedValue = detachedCss === undefined ? undefined : parse(detachedCss);
  const detached = detachedValue?.ok === true ? detachedValue.css : undefined;

  let knob: ReactNode;
  if (kind === "color") {
    knob = <ColorKnob name={name} css={css} color={color?.srgb} parse={parse} onCommit={commit} />;
  } else if (kind === "fontFamily") {
    knob = <FontKnob name={name} css={css} parse={parse} onCommit={commit} />;
  } else if (kind === "fontWeight") {
    const weight = Number(resolvedCss(shown.overrides, shown.seed, scheme, name));
    knob = (
      <NumberKnob
        name={name}
        value={Number.isFinite(weight) ? weight : undefined}
        min={100}
        max={900}
        step={100}
        format={String}
        parse={parse}
        onCommit={commit}
      />
    );
  } else if (name === "radius-step") {
    knob = <RadiusStepKnob css={css} onCommit={commit} />;
  } else if (isLengthToken(name)) {
    const resolved = resolvedCss(shown.overrides, shown.seed, scheme, name);
    knob = (
      <LengthKnob
        name={name}
        px={resolved === undefined ? undefined : lengthPx(resolved)}
        parse={parse}
        onCommit={commit}
      />
    );
  }

  return (
    <div role="group" aria-label={`--${name}`} className={styles.row()} data-token-row={name}>
      <div className={styles.rowHead()}>
        <span className={styles.name()}>{`--${name}`}</span>
        {edited ? (
          <>
            <Dot aria-hidden className={styles.edited()} />
            <span className="sr-only">Edited</span>
          </>
        ) : null}
        {target === undefined ? null : (
          <Button
            variant="outline"
            size="xs"
            className={styles.chip()}
            aria-label={`Detach --${name} from --${target} to a literal value`}
            disabled={detached === undefined}
            onClick={() => {
              if (detached !== undefined) {
                commit(detached);
              }
            }}>
            {`→ ${target}`}
          </Button>
        )}
        {contrast === undefined ? null : <ContrastMark contrast={contrast} />}
        {edited ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className={styles.reset()}
            aria-label={`Reset --${name}`}
            onClick={() => {
              edit({ type: "reset", scheme, name });
            }}>
            <ArrowsClockwise />
          </Button>
        ) : null}
      </div>
      {knob}
    </div>
  );
}

function matches(name: TokenName, query: string): boolean {
  return name.includes(query.trim().toLowerCase().replace(/^-+/u, ""));
}

export type StudioTokenPanelProps = {
  /** The sections a page leads with: stacked first in this order, the first opened on arrival. */
  lead?: readonly SectionId[];
  /** What follows the lead sections, such as a readout of what their knobs change. */
  afterLead?: ReactNode;
};

const NO_LEAD: readonly SectionId[] = [];

/** The editor's sections with `lead` moved to the front, in `lead`'s order. */
function leadFirst(lead: readonly SectionId[]) {
  const first = lead.flatMap((id) => STUDIO_SECTIONS.filter((section) => section.id === id));
  return [...first, ...STUDIO_SECTIONS.filter((section) => !lead.includes(section.id))];
}

const FOCUSABLE = "button, input, [tabindex]";

/**
 * Answers a canvas request for a token's knob while this panel is on screen: shows the token,
 * edits the requested scheme, and once the token's section has opened, focuses its knob, which
 * scrolls it into view. Only a focused knob answers the request; a hidden panel, such as the
 * desktop one on a phone, leaves it open for the panel in the inspector Sheet.
 */
function useFocusRequests(panel: RefObject<HTMLDivElement | null>, show: (name: TokenName) => void): void {
  const { request, answer } = useTokenFocus();
  const { setEditScheme } = useStudioEdits();
  // The request this panel has shown, whose knob it focuses once the section has opened.
  const [shown, setShown] = useState<number | undefined>(undefined);
  const reveal = useEffectEvent((next: TokenFocusRequest) => {
    setShown(next.serial);
    show(next.name);
    setEditScheme(next.scheme);
  });
  useEffect(() => {
    if (request === undefined) {
      return undefined;
    }
    // Read a frame after the commit, once the panel, and the section it opened, are laid out.
    const frame = requestAnimationFrame(() => {
      // A panel under `display: none` has no boxes.
      if ((panel.current?.getClientRects().length ?? 0) === 0) {
        return;
      }
      if (shown !== request.serial) {
        reveal(request);
        return;
      }
      const knob = panel.current?.querySelector(`[data-token-row="${request.name}"]`)?.lastElementChild;
      const target = knob?.matches(FOCUSABLE) === true ? knob : knob?.querySelector(FOCUSABLE);
      if (target instanceof HTMLElement) {
        target.focus();
        if (document.activeElement === target) {
          answer(request.serial);
        }
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [request, shown, panel, answer]);
}

/**
 * The token editor: every role token of the base theme, grouped in collapsible sections, each
 * with a knob that edits it live on every artboard in the edited scheme. A search filters the
 * tokens by name, and a toggle shows only the edited ones.
 */
export function StudioTokenPanel({ lead = NO_LEAD, afterLead }: StudioTokenPanelProps): ReactElement {
  const { overrides, edit, editScheme, setEditScheme } = useStudioEdits();
  const [query, setQuery] = useState("");
  const [editedOnly, setEditedOnly] = useState(false);
  const opening = lead[0];
  const [expanded, setExpanded] = useState<SectionId[]>(opening === undefined ? [] : [opening]);
  // A page that leads with sections opens the first on arrival, keeping what the visitor opened.
  const [arrivedLead, setArrivedLead] = useState(opening);
  if (opening !== arrivedLead) {
    setArrivedLead(opening);
    if (opening !== undefined && !expanded.includes(opening)) {
      setExpanded([opening, ...expanded]);
    }
  }
  const panel = useRef<HTMLDivElement>(null);
  useFocusRequests(panel, (name) => {
    // A filter that hides the token gives way, and its section opens.
    if (!matches(name, query) || editedOnly) {
      setQuery("");
      setEditedOnly(false);
    }
    const section = TOKEN_TABLE[name].section;
    if (!expanded.includes(section)) {
      setExpanded([...expanded, section]);
    }
  });
  const { colors, probe } = useResolvedColors(editScheme);

  const filtering = query.trim() !== "" || editedOnly;
  const visible = (name: TokenName): boolean =>
    matches(name, query) && (!editedOnly || overrideOf(overrides, editScheme, name) !== undefined);
  const sections = leadFirst(lead)
    .map((section) => {
      const names = sectionTokens(section.id);
      return {
        ...section,
        names,
        shown: names.filter(visible),
        count: editedCount(overrides, editScheme, names),
      };
    })
    .filter((section) => !filtering || section.shown.length > 0);
  // The readout follows the last lead section on show, or the controls when a filter hides them all.
  const lastLead = sections.findLast((section) => lead.includes(section.id))?.id;

  return (
    // Layout only: the scroll area sizes its content to fit, so the rows' long names and paired
    // controls would widen the panel; containment holds the editor to the panel's width.
    <div ref={panel} className={styles.panel()}>
      <StudioPanelSection title="Tokens">
        {probe}
        <div className={styles.controls()}>
          <SingleToggle
            label="Edited scheme"
            size="sm"
            options={SCHEMES}
            labels={SCHEME_LABELS}
            value={editScheme}
            onValueChange={setEditScheme}
          />
          <div className={styles.filters()}>
            <TextField
              aria-label="Filter tokens"
              placeholder="Filter tokens"
              icon={<MagnifyingGlass />}
              className={styles.search()}
              value={query}
              onChange={setQuery}
            />
            <Toggle variant="outline" size="sm" pressed={editedOnly} onPressedChange={setEditedOnly}>
              Edited only
            </Toggle>
          </div>
        </div>
        {lastLead === undefined ? afterLead : null}
        {sections.length === 0 ? (
          <p className={styles.empty()}>{editedOnly ? "No edited tokens match." : "No tokens match."}</p>
        ) : (
          <Accordion.Root
            multiple
            className={styles.sections()}
            value={filtering ? sections.map((section) => section.id) : expanded}
            onValueChange={(next) => {
              setExpanded(
                next.filter((id): id is SectionId => STUDIO_SECTIONS.some((section) => section.id === id))
              );
            }}>
            {sections.map((section) => (
              <Fragment key={section.id}>
                <Accordion.Item value={section.id}>
                  <Accordion.Header>
                    <Accordion.Trigger className={styles.trigger()}>
                      {section.title}
                      {section.count === 0 ? null : (
                        <Badge size="sm" variant="secondary" className={styles.count()}>
                          {String(section.count)}
                          <span className="sr-only"> edited</span>
                        </Badge>
                      )}
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content>
                    <div className={styles.content()}>
                      {section.count === 0 ? null : (
                        <Button
                          variant="ghost"
                          size="xs"
                          className={styles.sectionReset()}
                          onClick={() => {
                            edit({ type: "reset-section", scheme: editScheme, names: section.names });
                          }}>
                          {`Reset ${section.title.toLowerCase()}`}
                        </Button>
                      )}
                      {section.shown.map((name) => (
                        <TokenRow key={name} name={name} colors={colors} />
                      ))}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
                {section.id === lastLead ? afterLead : null}
              </Fragment>
            ))}
          </Accordion.Root>
        )}
      </StudioPanelSection>
    </div>
  );
}
