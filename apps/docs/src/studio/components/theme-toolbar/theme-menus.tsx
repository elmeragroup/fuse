"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { Popover } from "@elmeragroup/fuse/popover";
import { Text } from "@elmeragroup/fuse/text";
import { TextField } from "@elmeragroup/fuse/text-field";
import type { Density } from "@elmeragroup/fuse/theme";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { STUDIO_METRICS } from "../../lib/density-metrics";
import type { ArtboardSpec } from "../../lib/documents";
import { STUDIO_SECTIONS, TOKEN_TABLE, matchesTokenQuery } from "../../lib/tokens";
import type { SectionId, TokenName } from "../../lib/tokens";
import { menuPlacement } from "../../lib/viewport";
import type { MenuPlacement } from "../../lib/viewport";
import { METRIC_ROLES, MetricKnob } from "../density/density-panel";
import { useArtboardScopeOf } from "../studio-artboard";
import { TokenRow, useResolvedColors } from "../studio-token-panel";
import type { TokenRowProps } from "../studio-token-panel";
import { useViewportCommands, useViewportState } from "../studio-viewport";

const themeMenus = tv({
  slots: {
    // The popover's column, which scrolls once its knobs outgrow the room beside its trigger.
    // Base UI writes `--available-height` on the positioner, and the menu its `--menu-room`.
    popup: "max-h-[min(var(--available-height,100vh),var(--menu-room,100vh))] w-80 gap-3 overflow-y-auto",
    // The trigger is one text line tall, under the 24px target floor in the dense chrome.
    section: "text-sm min-h-6 gap-2",
    rows: "flex flex-col gap-3 pb-2",
    metric: "flex min-w-0 flex-col gap-1.5",
    metricName: "text-xs font-mono break-all",
    empty: "text-sm text-muted-foreground",
  },
});

const styles = themeMenus();

/**
 * The open menu of the theme toolbar, by title, which the toolbar owns so that one menu opens at a
 * time and every menu closes with the toolbar. `change` opens or closes one menu.
 */
export type OpenMenu = {
  readonly title: string | undefined;
  readonly change: (title: string, open: boolean) => void;
};

/**
 * Screen px between a menu and its trigger: past the toolbar's 4px padding and 1px border, so the
 * menu opens clear of the bar rather than over its edge.
 */
const MENU_OFFSET = 8;

/**
 * Screen px a menu keeps from its trigger and from the canvas's edge: its offset, and a margin
 * wider than Base UI's collision padding, so the side it opens on fits.
 */
const MENU_GAP = MENU_OFFSET + 12;

/** The least room below its trigger that keeps a menu below the bar. */
const MIN_MENU_ROOM = 160;

/**
 * Re-measures an open menu a frame after each camera move or canvas resize, once the toolbar has
 * followed. Only an open menu renders it, so a closed one does not render on camera moves.
 */
function FollowCamera({ measure }: { measure: () => void }): null {
  const { canvas } = useViewportCommands();
  const { viewport } = useViewportState();
  // `viewport` places the trigger: each camera move measures again.
  useEffect(() => {
    const request = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(request);
    };
  }, [viewport, measure]);
  useEffect(() => {
    const frame = canvas();
    if (frame === null) {
      return undefined;
    }
    let request = 0;
    const resizes = new ResizeObserver(() => {
      cancelAnimationFrame(request);
      request = requestAnimationFrame(measure);
    });
    resizes.observe(frame);
    return () => {
      cancelAnimationFrame(request);
      resizes.disconnect();
    };
  }, [canvas, measure]);
  return null;
}

/**
 * A menu of the theme toolbar: a toolbar button that opens a popover holding the menu's knobs,
 * which mount only while it is open. `count`, when given, shows how many tokens it lists.
 *
 * Base UI picks a popup's side before it computes `--available-height` for that side, so a menu
 * taller than the room below its trigger would flip beside the toolbar and cover its other
 * buttons. The menu picks its side itself, above or below the trigger (`menuPlacement`), and caps
 * its height to the room there, which it then fits, and scrolls inside. It measures as it opens,
 * and again while open, a frame after each camera move or canvas resize (`FollowCamera`), once
 * the toolbar has followed.
 */
export function ThemeMenu({
  title,
  description,
  count,
  menu,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  menu: OpenMenu;
  children: ReactNode;
}): ReactElement {
  const { canvas } = useViewportCommands();
  const trigger = useRef<HTMLButtonElement>(null);
  const open = menu.title === title;
  const [placement, setPlacement] = useState<MenuPlacement | undefined>(undefined);
  const measure = useCallback(() => {
    const below = trigger.current?.getBoundingClientRect();
    const frame = canvas()?.getBoundingClientRect();
    if (below === undefined || frame === undefined) {
      return;
    }
    const next = menuPlacement(below, frame, MENU_GAP, MIN_MENU_ROOM);
    setPlacement((current) => (current?.side === next.side && current.room === next.room ? current : next));
  }, [canvas]);
  const cap: CSSProperties & Record<"--menu-room", string> = {
    "--menu-room": placement === undefined ? "100vh" : `${String(placement.room)}px`,
  };
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          measure();
        }
        menu.change(title, next);
      }}>
      {open ? <FollowCamera measure={measure} /> : null}
      <Toolbar.Button
        ref={trigger}
        render={<Popover.Trigger render={<Button variant="ghost" size="sm" />} />}>
        {title}
        {count === undefined ? null : (
          <Badge size="sm" variant="secondary">
            {String(count)}
            <span className="sr-only"> tokens</span>
          </Badge>
        )}
      </Toolbar.Button>
      <Popover.Content
        side={placement?.side ?? "bottom"}
        align="start"
        sideOffset={MENU_OFFSET}
        // oxlint-disable-next-line shadcn/no-inline-styles -- a custom property only: the room on the menu's side of its trigger
        style={cap}
        className={styles.popup()}>
        <Popover.Header>
          <Popover.Title>{title}</Popover.Title>
          {description === undefined ? null : <Popover.Description>{description}</Popover.Description>}
        </Popover.Header>
        {children}
      </Popover.Content>
    </Popover.Root>
  );
}

/**
 * The theme toolbar's token menus, named after the studio pages that show their tokens: Color
 * holds the color tokens of `names`, grouped in the token editor's sections, and Shape and Type
 * hold the tokens of the editor's Shape and Typography sections. Each edits in the scope of
 * `artboard`. A menu with no tokens does not render. A `counted` menu shows how many tokens it
 * lists, as the part bar's do.
 */
export function TokenMenus({
  artboard,
  names,
  counted,
  menu,
}: {
  artboard: ArtboardSpec;
  names: readonly TokenName[];
  counted: boolean;
  menu: OpenMenu;
}): ReactElement {
  const colors = names.filter((name) => TOKEN_TABLE[name].kind === "color");
  const corners = names.filter((name) => TOKEN_TABLE[name].section === "shape");
  const type = names.filter((name) => TOKEN_TABLE[name].section === "typography");
  const count = (tokens: readonly TokenName[]) => (counted ? tokens.length : undefined);
  return (
    <>
      {colors.length === 0 ? null : (
        <ThemeMenu title="Color" count={count(colors)} menu={menu}>
          <ColorKnobs artboard={artboard} tokens={colors} />
        </ThemeMenu>
      )}
      {corners.length === 0 ? null : (
        <ThemeMenu
          title="Shape"
          description="Edits apply to every artboard."
          count={count(corners)}
          menu={menu}>
          <TokenKnobs artboard={artboard} tokens={corners} />
        </ThemeMenu>
      )}
      {type.length === 0 ? null : (
        <ThemeMenu title="Type" count={count(type)} menu={menu}>
          <TokenKnobs artboard={artboard} tokens={type} />
        </ThemeMenu>
      )}
    </>
  );
}

/** A list this short opens with every section open; a longer one opens its first section only. */
const SHORT_LIST = 12;

/**
 * The Color menu's knobs: a filter, then a section per color section of the token editor, with a
 * `TokenRow` per token edited in the target's scope and scheme, as the Selection section edits
 * them. A filter opens every section that holds a match.
 */
function ColorKnobs({
  artboard,
  tokens,
}: {
  artboard: ArtboardSpec;
  tokens: readonly TokenName[];
}): ReactElement {
  const scope = useArtboardScopeOf(artboard);
  const [query, setQuery] = useState("");
  const listed = STUDIO_SECTIONS.filter((section) =>
    tokens.some((name) => TOKEN_TABLE[name].section === section.id)
  ).map((section) => section.id);
  const [expanded, setExpanded] = useState<readonly SectionId[]>(() =>
    tokens.length <= SHORT_LIST ? listed : listed.slice(0, 1)
  );
  const { colors, probe } = useResolvedColors(scope.scheme, scope);
  const sections = STUDIO_SECTIONS.map((section) => ({
    ...section,
    names: tokens.filter(
      (name) => TOKEN_TABLE[name].section === section.id && matchesTokenQuery(name, query)
    ),
  })).filter((section) => section.names.length > 0);
  const open = query.trim() === "" ? expanded : sections.map((section) => section.id);

  let list: ReactNode = null;
  if (sections.length === 0) {
    list = <Text className={styles.empty()}>No colors match.</Text>;
  } else if (scope.seed !== undefined) {
    list = (
      <Accordion.Root
        multiple
        value={[...open]}
        onValueChange={(next) => {
          setExpanded(listed.filter((id) => next.includes(id)));
        }}>
        {sections.map((section) => (
          <Accordion.Item key={section.id} value={section.id}>
            <Accordion.Header>
              <Accordion.Trigger className={styles.section()}>{section.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <div className={styles.rows()}>
                {section.names.map((name) => (
                  <TokenRow key={name} name={name} colors={colors} scope={scope} />
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    );
  }

  return (
    <>
      {probe}
      <TextField
        aria-label="Filter colors"
        placeholder="Filter colors"
        icon={<MagnifyingGlass />}
        value={query}
        onChange={setQuery}
      />
      {list}
    </>
  );
}

/** The resolved colors a row reads when it edits no color: none. */
const NO_COLORS: TokenRowProps["colors"] = new Map();

/** The Shape or Type menu's knobs: a `TokenRow` per token, edited in the target's scope and scheme. */
function TokenKnobs({
  artboard,
  tokens,
}: {
  artboard: ArtboardSpec;
  tokens: readonly TokenName[];
}): ReactElement | null {
  const scope = useArtboardScopeOf(artboard);
  return scope.seed === undefined ? null : (
    <div className={styles.rows()}>
      {tokens.map((name) => (
        <TokenRow key={name} name={name} colors={NO_COLORS} scope={scope} />
      ))}
    </div>
  );
}

/**
 * The Density menu's knobs: every density metric at `density`, a section per role as the Density
 * page's panel groups them, each metric's name over that panel's knob. An edit applies to every
 * artboard in that density.
 */
export function DensityKnobs({ density }: { density: Density }): ReactElement {
  return (
    <Accordion.Root multiple defaultValue={["control"]}>
      {METRIC_ROLES.map(({ role, title }) => (
        <Accordion.Item key={role} value={role}>
          <Accordion.Header>
            <Accordion.Trigger className={styles.section()}>{title}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <div className={styles.rows()}>
              {STUDIO_METRICS.filter((metric) => metric.role === role).map((metric) => (
                <div key={metric.name} className={styles.metric()}>
                  <span className={styles.metricName()}>{`--${metric.name}`}</span>
                  <MetricKnob metric={metric} density={density} />
                </div>
              ))}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
