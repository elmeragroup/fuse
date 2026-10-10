"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";
import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Collapsible } from "@elmeragroup/fuse/collapsible";
import { Separator } from "@elmeragroup/fuse/separator";
import { Toggle } from "@elmeragroup/fuse/toggle";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import {
  arcMidpoint,
  arcPath,
  checkCorner,
  cornerEquation,
  cornerSum,
  formatPx,
  insetOf,
  insetRedline,
  packLabels,
  usedRadii,
} from "../../lib/studio/corners";
import type { CornerCheck, CornerReading, CornerSide, InsetBox } from "../../lib/studio/corners";
import { hasCornerXray } from "../../lib/studio/documents";
import type { Viewport } from "../../lib/studio/viewport";
import { isTypingTarget } from "../../lib/typing-target";
import { ChromeScope } from "./chrome-scope";
import { useStudioEdits } from "./studio-edits";
import { CornerGlyph } from "./studio-icons";
import { OVERLAYS } from "./studio-shortcuts";
import { useStudio } from "./studio-state";
import { drawnViewport, useViewportState } from "./studio-viewport";

const cornerXray = tv({
  slots: {
    overlay: "pointer-events-none absolute inset-0 z-20 overflow-hidden",
    svg: "absolute inset-0 size-full",
    shellArc: "stroke-primary stroke-2",
    redline: "stroke-error",
    // Joins an inset or a label to a part further in: thin and dashed, under the numbers.
    leader: "stroke-muted-foreground [stroke-dasharray:2_2]",
    partArc: "stroke-primary stroke-2 data-[mismatch=true]:stroke-warning data-[mismatch=true]:stroke-3",
    // Each label sits where the packing put it, at one screen size whatever the zoom.
    label: "absolute top-(--label-y) left-(--label-x)",
    // A hidden copy of a label, measured before the labels are packed.
    probe: "invisible absolute top-0 left-0",
    tag: "font-mono whitespace-nowrap",
    glyph: "size-4",
    separator: "h-5",
    readout: "flex flex-col gap-2 py-1",
    readoutTrigger: "w-full justify-start",
    list: "text-xs m-0 flex list-none flex-col gap-2 px-2 pb-2",
    entry: "flex flex-col gap-0.5",
    part: "text-muted-foreground",
    equation: "font-mono",
    empty: "text-sm px-2 text-muted-foreground",
  },
});

const styles = cornerXray();

/**
 * The utility an inner part rounds with, `var(--inner-corner, var(--radius))` in fuse.css. A
 * part carries it bare, or behind `[:where(&)]:`, which only drops its weight; a variant that
 * targets other elements, such as `[&>kbd]:`, does not round the part itself.
 */
// oxlint-disable-next-line elmera/no-raw-class-map -- a class name the X-ray looks for on parts, never applied
const INNER_UTILITY = "rounded-inner";

const WEIGHTLESS = /^(?:\[:where\(&\)\]:)+/u;

/** The corner a shell publishes for the parts inside it (corner-radius.ts). */
const PUBLISHED = "--inner-corner";

/** One inner part's corner, measured off the page. */
export type MeasuredCorner = {
  /** The part's slot and its shell's, such as `tabs-trigger in tabs-list`. */
  readonly part: string;
  readonly artboard: string;
  readonly reading: CornerReading;
  readonly check: CornerCheck;
  readonly equation: string;
};

/** A point and a corner radius, in world px: the canvas at zoom 1, before the camera. */
type WorldCorner = { readonly x: number; readonly y: number; readonly r: number };

/**
 * One inner part's corner and its shell's, measured once in world px, so a camera move only
 * projects them. Each radius is the one the box paints with ({@link usedRadii}); the reading
 * keeps the resolved ones the formula is checked against.
 */
type CornerGeometry = MeasuredCorner & {
  readonly side: CornerSide;
  /** The shell's corner box: its top corner on the part's side. */
  readonly shell: WorldCorner;
  /** The part's top corner on the same side. */
  readonly at: WorldCorner;
  /** The shell's border plus padding, measured from its edge, in world px as drawn. */
  readonly inset: number;
};

/** The physical edge a side reads in the left-to-right canvas. */
function edgeOf(side: CornerSide): "left" | "right" {
  return side === "end" ? "right" : "left";
}

function isInnerPart(element: Element): boolean {
  return [...element.classList].some((token) => token.replace(WEIGHTLESS, "") === INNER_UTILITY);
}

/** Computed styles for one measurement, each element's read once. */
function styleReader(): (element: Element) => CSSStyleDeclaration {
  const read = new Map<Element, CSSStyleDeclaration>();
  return (element) => {
    let style = read.get(element);
    if (style === undefined) {
      style = getComputedStyle(element);
      read.set(element, style);
    }
    return style;
  };
}

type StyleOf = ReturnType<typeof styleReader>;

function px(style: CSSStyleDeclaration, property: string): number {
  return Number.parseFloat(style.getPropertyValue(property));
}

function published(styleOf: StyleOf, element: Element | null): string {
  return element === null ? "" : styleOf(element).getPropertyValue(PUBLISHED).trim();
}

/** Whether `element` publishes a corner of its own, rather than passing its parent's on. */
function publishes(styleOf: StyleOf, element: Element): boolean {
  const value = published(styleOf, element);
  return value !== "" && value !== published(styleOf, element.parentElement);
}

/** Whether `element` draws an edge a corner can be seen on: rounded, bordered or filled. */
function drawsEdge(style: CSSStyleDeclaration): boolean {
  return (
    Number.parseFloat(style.borderTopLeftRadius) > 0 ||
    Number.parseFloat(style.borderLeftWidth) > 0 ||
    (style.backgroundColor !== "transparent" && style.backgroundColor !== "rgba(0, 0, 0, 0)")
  );
}

function insetBox(style: CSSStyleDeclaration, side: CornerSide): InsetBox {
  const edge = edgeOf(side);
  return {
    border: px(style, `border-${edge}-width`),
    padding: px(style, `padding-${edge}`),
    margin: px(style, `margin-${edge}`),
  };
}

/**
 * How much larger than its layout box `element` is drawn in the world: below 1 while an
 * ancestor's transform shrinks it, as a popup's opening keyframes do. Its box on screen holds
 * both that transform and the camera's zoom.
 */
function drawnScale(element: Element, rect: DOMRect, zoom: number): number {
  return element instanceof HTMLElement && element.offsetWidth > 0
    ? rect.width / element.offsetWidth / zoom
    : 1;
}

/** The top corner radius `element` paints on `side`, in world px, as its transforms draw it. */
function paintedRadius(element: Element, style: CSSStyleDeclaration, side: CornerSide, zoom: number): number {
  const rect = element.getBoundingClientRect();
  const width = element instanceof HTMLElement ? element.offsetWidth : rect.width / zoom;
  const height = element instanceof HTMLElement ? element.offsetHeight : rect.height / zoom;
  const used = usedRadii(width, height, {
    topLeft: px(style, "border-top-left-radius"),
    topRight: px(style, "border-top-right-radius"),
    bottomRight: px(style, "border-bottom-right-radius"),
    bottomLeft: px(style, "border-bottom-left-radius"),
  });
  return (side === "end" ? used.topRight : used.topLeft) * drawnScale(element, rect, zoom);
}

function slotOf(element: Element): string {
  return element.getAttribute("data-slot") ?? element.tagName.toLowerCase();
}

/**
 * Every visible inner part in `world`, with its shell's corner and the inset between them,
 * read from computed styles. A part's shell is the nearest ancestor that publishes its own
 * `--inner-corner`; the corner it is concentric with is that shell's, or, for a padded section
 * such as a Card's, the nearest box above it that draws an edge. The inset is every border,
 * padding and margin from that box down to the part, on the inline side the part lies nearer,
 * as an inline-end addon's button lies against the field's end corner. Positions are taken
 * through `camera`, the camera the canvas draws now, back into world px.
 */
function measureCorners(canvas: HTMLElement, world: Element, camera: Viewport): CornerGeometry[] {
  const styleOf = styleReader();
  const origin = canvas.getBoundingClientRect();
  const toWorld = (clientX: number, clientY: number) => ({
    x: (clientX - origin.left - camera.x) / camera.zoom,
    y: (clientY - origin.top - camera.y) / camera.zoom,
  });
  const corners: CornerGeometry[] = [];
  for (const part of world.querySelectorAll<HTMLElement>(`[data-demo-stage] [class*="${INNER_UTILITY}"]`)) {
    const stage = part.closest("[data-demo-stage]");
    if (!isInnerPart(part) || stage === null || part.getClientRects().length === 0) {
      continue;
    }
    let shell = part.parentElement;
    while (shell !== null && shell !== stage && !publishes(styleOf, shell)) {
      shell = shell.parentElement;
    }
    // A part outside every shell rounds with `--radius`, not concentrically.
    if (shell === null || shell === stage) {
      continue;
    }
    let corner: Element = shell;
    while (corner !== stage && !drawsEdge(styleOf(corner)) && corner.parentElement !== null) {
      corner = corner.parentElement;
    }
    const cornerRect = corner.getBoundingClientRect();
    const partRect = part.getBoundingClientRect();
    // A part as near both sides, such as a full-width row, takes the start corner.
    const side: CornerSide =
      cornerRect.right - partRect.right < partRect.left - cornerRect.left - 1 ? "end" : "start";
    const chain: InsetBox[] = [];
    for (let box = part.parentElement; box !== null; box = box.parentElement) {
      chain.unshift(insetBox(styleOf(box), side));
      if (box === corner) {
        break;
      }
    }
    const edge = edgeOf(side);
    const outer = px(styleOf(corner), `border-top-${edge}-radius`);
    const inner = px(styleOf(part), `border-top-${edge}-radius`);
    const reading = { outer, inner, ...insetOf(chain) };
    const shellAt = toWorld(side === "end" ? cornerRect.right : cornerRect.left, cornerRect.top);
    const partAt = toWorld(side === "end" ? partRect.right : partRect.left, partRect.top);
    corners.push({
      part: `${slotOf(part)} in ${slotOf(shell)}`,
      artboard: stage.getAttribute("aria-label") ?? "",
      reading,
      check: checkCorner(reading),
      equation: cornerEquation(reading),
      side,
      shell: { ...shellAt, r: paintedRadius(corner, styleOf(corner), side, camera.zoom) },
      at: { ...partAt, r: paintedRadius(part, styleOf(part), side, camera.zoom) },
      inset: (reading.border + reading.padding) * drawnScale(corner, cornerRect, camera.zoom),
    });
  }
  return corners;
}

type CornerXrayValue = {
  /** The page offers the X-ray. */
  available: boolean;
  /** The X-ray is drawn: the visitor turned it on, on a page that offers it. */
  active: boolean;
  setOn: (on: boolean) => void;
  /** The corners the overlay last measured, for the inspector's text alternative. */
  corners: readonly MeasuredCorner[];
  publish: (corners: readonly MeasuredCorner[]) => void;
};

const CornerXrayContext = createContext<CornerXrayValue | undefined>(undefined);

function useCornerXray(): CornerXrayValue {
  const value = use(CornerXrayContext);
  if (value === undefined) {
    throw new Error("useCornerXray must be used within CornerXrayProvider");
  }
  return value;
}

/**
 * Owns the corner X-ray for the studio layout: whether it is on, and what it measured. It stays
 * on across a page switch and draws only on a page that offers it, where `X` toggles it.
 */
export function CornerXrayProvider({ children }: { children: ReactNode }): ReactElement {
  const available = hasCornerXray(usePathname());
  const [on, setOn] = useState(false);
  const [corners, setCorners] = useState<readonly MeasuredCorner[]>([]);
  const lastPublished = useRef("");
  const active = available && on;
  const publish = useCallback((next: readonly MeasuredCorner[]) => {
    const key = JSON.stringify(next);
    if (key !== lastPublished.current) {
      lastPublished.current = key;
      setCorners(next);
    }
  }, []);

  useEffect(() => {
    if (!available) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
      if (
        plain &&
        !event.defaultPrevented &&
        event.key.toLowerCase() === "x" &&
        !isTypingTarget(event.target, OVERLAYS)
      ) {
        event.preventDefault();
        setOn((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [available]);

  const value = useMemo(
    (): CornerXrayValue => ({
      available,
      active,
      setOn,
      corners: active ? corners : [],
      publish,
    }),
    [available, active, corners, publish]
  );
  return <CornerXrayContext.Provider value={value}>{children}</CornerXrayContext.Provider>;
}

/** The toolbar's X-ray switch and the separator after it, on a page that offers it. */
export function CornerXrayToggle(): ReactElement | null {
  const { available, active, setOn } = useCornerXray();
  if (!available) {
    return null;
  }
  return (
    <>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={<Toggle size="sm" aria-label="Corner X-ray" pressed={active} onPressedChange={setOn} />}>
          <CornerGlyph className={styles.glyph()} />
        </Tooltip.Trigger>
        <Tooltip.Content>Corner X-ray (X)</Tooltip.Content>
      </Tooltip.Root>
      <Separator orientation="vertical" className={styles.separator()} />
    </>
  );
}

/** The readout's line: the formula with its numbers, and what was off or clamped. */
function readoutOf({ equation, check, reading }: MeasuredCorner): string {
  if (check.mismatch) {
    return `${equation} · measured ${formatPx(reading.inner)}px`;
  }
  return check.clamped ? `${equation} · clamped` : equation;
}

/** The overlay's short label, with the measured corner after a mismatch. */
function labelOf({ check, reading }: MeasuredCorner): string {
  const sum = cornerSum(reading);
  return check.mismatch ? `${sum} ≠ ${formatPx(reading.inner)}px` : sum;
}

/** A corner projected through the camera into canvas screen px. */
function project(corner: WorldCorner, camera: Viewport) {
  return {
    x: camera.x + corner.x * camera.zoom,
    y: camera.y + corner.y * camera.zoom,
    r: corner.r * camera.zoom,
  };
}

/** Whether `world` runs a transition or an animation, which moves its parts frame by frame. */
function animating(world: Element): boolean {
  return world.getAnimations({ subtree: true }).some((animation) => animation.playState === "running");
}

/** A label's rendered size, in screen px; it stays one size at any zoom. */
type LabelSize = { readonly width: number; readonly height: number };

/**
 * Measures the corners once, and again only when they can have changed: after an edit or an
 * artboard setting, a DOM change in the world, a resize, a font load, a scroll inside an
 * artboard, and on every frame while
 * a transition or animation runs inside it. The camera is read every frame only while it
 * glides; otherwise the viewport state is the camera drawn.
 */
function useCornerGeometry(active: boolean, canvas: () => HTMLElement | null) {
  const { publish } = useCornerXray();
  const { overrides } = useStudioEdits();
  const { theme, settingsOf } = useStudio();
  const { viewport, gliding } = useViewportState();
  const [corners, setCorners] = useState<readonly CornerGeometry[]>([]);
  const [glideCamera, setGlideCamera] = useState<Viewport | undefined>(undefined);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const latest = useRef({ viewport, gliding });
  useLayoutEffect(() => {
    latest.current = { viewport, gliding };
  }, [viewport, gliding]);
  const invalidate = useRef<() => void>(() => undefined);
  const wake = useRef<() => void>(() => undefined);

  useEffect(() => {
    const element = canvas();
    const world = element?.querySelector("[data-studio-world]");
    if (!active || element === null || world === null || world === undefined) {
      return undefined;
    }
    let dirty = true;
    let frame = 0;
    let measured = "";
    const run = () => {
      frame = 0;
      const { viewport: camera, gliding: moving } = latest.current;
      const drawn = moving ? (drawnViewport(element) ?? camera) : camera;
      if (moving) {
        setGlideCamera(drawn);
      }
      if (dirty) {
        dirty = false;
        const next = measureCorners(element, world, drawn);
        const key = JSON.stringify(next);
        if (key !== measured) {
          measured = key;
          setCorners(next);
          publish(
            next.map(({ part, artboard, reading, check, equation }) => ({
              part,
              artboard,
              reading,
              check,
              equation,
            }))
          );
        }
      }
      const running = animating(world);
      dirty ||= running;
      if (running || moving) {
        frame = requestAnimationFrame(run);
      } else {
        setGlideCamera(undefined);
      }
    };
    const schedule = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(run);
      }
    };
    wake.current = schedule;
    invalidate.current = () => {
      dirty = true;
      schedule();
    };
    const resizes = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = element;
      setBounds((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );
      invalidate.current();
    });
    // Observing a target again restarts its observation, so each is observed once.
    const observed = new Set<Element>();
    const observeStages = () => {
      for (const target of [element, ...world.querySelectorAll("[data-demo-stage]")]) {
        if (!observed.has(target)) {
          observed.add(target);
          resizes.observe(target);
        }
      }
    };
    observeStages();
    // A page switch brings new artboards, whose sizes are watched from then on.
    const mutations = new MutationObserver(() => {
      observeStages();
      invalidate.current();
    });
    mutations.observe(world, { subtree: true, childList: true, attributes: true, characterData: true });
    const onFonts = invalidate.current;
    document.fonts.addEventListener("loadingdone", onFonts);
    // A transition that starts inside the world runs the frame loop until it ends.
    world.addEventListener("transitionrun", schedule);
    world.addEventListener("animationstart", schedule);
    // Scrolling inside an artboard, such as an overflowing popup's, moves its parts without a
    // DOM change or a resize. Scroll events do not bubble, so the canvas listens as they descend.
    const onScroll = (event: Event) => {
      if (
        event.target instanceof Element &&
        world.contains(event.target) &&
        event.target.closest("[data-demo-stage]") !== null
      ) {
        invalidate.current();
      }
    };
    element.addEventListener("scroll", onScroll, { capture: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
      document.fonts.removeEventListener("loadingdone", onFonts);
      world.removeEventListener("transitionrun", schedule);
      world.removeEventListener("animationstart", schedule);
      element.removeEventListener("scroll", onScroll, { capture: true });
      invalidate.current = () => undefined;
      wake.current = () => undefined;
      setCorners([]);
      publish([]);
    };
  }, [active, canvas, publish]);

  // An edit, an artboard's settings or the base theme can change every number.
  useEffect(() => {
    invalidate.current();
  }, [overrides, settingsOf, theme]);

  // A glide moves the camera without a render per frame; the loop follows it.
  useEffect(() => {
    if (gliding) {
      wake.current();
    }
  }, [gliding]);

  return { corners, camera: glideCamera ?? viewport, bounds };
}

/**
 * The X-ray drawing, in screen space over the canvas, so its lines and labels stay crisp at any
 * zoom: each shell's outer corner arc and its inset as a redline from its edge, each inner
 * part's arc, a leader from the inset to a part further in, and the numbers, packed so no two
 * labels overlap. A part more than half a pixel off the formula is marked. The geometry is
 * measured once and projected through the camera, so a pan or a zoom reads no styles. Screen
 * readers get the inspector's list.
 */
export function CornerXrayOverlay({ canvas }: { canvas: () => HTMLElement | null }): ReactElement | null {
  const { active } = useCornerXray();
  const { corners, camera, bounds } = useCornerGeometry(active, canvas);
  const overlay = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<ReadonlyMap<string, LabelSize>>(new Map());

  // A label is sized once per text, from a hidden copy, before it is packed.
  const probes = [...new Set(corners.map(labelOf))].filter((label) => !sizes.has(label));
  const probing = probes.join("\n");
  useLayoutEffect(() => {
    const pending = overlay.current?.querySelectorAll<HTMLElement>("[data-label-probe]") ?? [];
    if (probing === "" || pending.length === 0) {
      return;
    }
    setSizes((current) => {
      const next = new Map(current);
      for (const probe of pending) {
        next.set(probe.dataset.labelProbe ?? "", { width: probe.offsetWidth, height: probe.offsetHeight });
      }
      return next;
    });
  }, [probing]);

  if (!active) {
    return null;
  }

  const drawings = corners.map((corner) => ({
    ...corner,
    label: labelOf(corner),
    shellAt: project(corner.shell, camera),
    partAt: project(corner.at, camera),
    insetEnd: project(corner.shell, camera).x + (corner.side === "end" ? -1 : 1) * corner.inset * camera.zoom,
  }));
  // Parts in one shell share its arc and its inset, so each draws once, level with the first part.
  const shells = new Map<string, (typeof drawings)[number]>();
  for (const drawing of drawings) {
    const key = [drawing.shell.x, drawing.shell.y, drawing.shell.r, drawing.side, drawing.inset].join();
    if (!shells.has(key)) {
      shells.set(key, drawing);
    }
  }
  const inView = (x: number, y: number) => x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height;
  const labelled = drawings.flatMap((drawing) => {
    const anchor = arcMidpoint(drawing.partAt.x, drawing.partAt.y, drawing.partAt.r, drawing.side);
    const size = sizes.get(drawing.label);
    return size === undefined || !inView(anchor.x, anchor.y) ? [] : [{ drawing, anchor, size }];
  });
  const places = packLabels(
    labelled.map(({ anchor, size, drawing }) => ({ anchor, ...size, side: drawing.side })),
    bounds
  );

  return (
    <ChromeScope ref={overlay} aria-hidden className={styles.overlay()} data-corner-xray>
      <svg className={styles.svg()} fill="none">
        {[...shells].map(([key, { shellAt, insetEnd, partAt, side }]) => (
          <g key={key}>
            <path className={styles.shellArc()} d={arcPath(shellAt.x, shellAt.y, shellAt.r, side)} />
            <path className={styles.redline()} d={insetRedline(shellAt.x, insetEnd, partAt.y)} />
          </g>
        ))}
        {drawings.map((drawing, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- the measured list has no other identity; it is redrawn whole
          <g key={index}>
            {Math.abs(drawing.partAt.x - drawing.insetEnd) > 1 ? (
              <path
                className={styles.leader()}
                d={`M ${String(drawing.insetEnd)} ${String(drawing.partAt.y)} L ${String(drawing.partAt.x)} ${String(drawing.partAt.y)}`}
              />
            ) : null}
            <path
              className={styles.partArc()}
              data-mismatch={drawing.check.mismatch}
              d={arcPath(drawing.partAt.x, drawing.partAt.y, drawing.partAt.r, drawing.side)}
            />
          </g>
        ))}
        {labelled.map(({ anchor, size, drawing }, index) => {
          const place = places[index];
          if (place === undefined || !place.leader) {
            return null;
          }
          const x = drawing.side === "end" ? place.x + size.width : place.x;
          return (
            // oxlint-disable-next-line react/no-array-index-key -- the measured list has no other identity; it is redrawn whole
            <path
              key={index}
              className={styles.leader()}
              d={`M ${String(anchor.x)} ${String(anchor.y)} L ${String(x)} ${String(place.y)}`}
            />
          );
        })}
      </svg>
      {labelled.map(({ drawing }, index) => {
        const place = places[index];
        if (place === undefined) {
          return null;
        }
        const at: CSSProperties & Record<`--${string}`, string> = {
          "--label-x": `${String(place.x)}px`,
          "--label-y": `${String(place.y)}px`,
        };
        return (
          // oxlint-disable-next-line react/no-array-index-key -- the measured list has no other identity; it is redrawn whole
          <div
            key={index}
            className={styles.label()}
            style={at}
            data-corner-label
            data-mismatch={drawing.check.mismatch}>
            <Badge
              size="sm"
              variant={drawing.check.mismatch ? "warning" : "secondary"}
              className={styles.tag()}>
              {drawing.label}
            </Badge>
          </div>
        );
      })}
      {probes.map((label) => (
        <div key={label} className={styles.probe()} data-label-probe={label}>
          <Badge size="sm" variant="warning" className={styles.tag()}>
            {label}
          </Badge>
        </div>
      ))}
    </ChromeScope>
  );
}

/** The most corners the readout lists open; a longer list opens on request. */
const READOUT_OPEN_MAX = 6;

/**
 * The X-ray's text alternative in the inspector: every measured corner, in reading order. It
 * follows the page's lead token section, and starts collapsed once it holds more than
 * {@link READOUT_OPEN_MAX} corners, so the knobs stay in view.
 */
export function CornerReadout(): ReactElement | null {
  const { active, corners } = useCornerXray();
  const [open, setOpen] = useState<boolean | undefined>(undefined);
  if (!active) {
    return null;
  }
  return (
    <Collapsible.Root
      open={open ?? corners.length <= READOUT_OPEN_MAX}
      onOpenChange={setOpen}
      className={styles.readout()}>
      <Collapsible.Trigger render={<Button variant="ghost" size="sm" className={styles.readoutTrigger()} />}>
        Measured corners
        <Badge size="sm" variant="secondary">
          {String(corners.length)}
        </Badge>
      </Collapsible.Trigger>
      <Collapsible.Content>
        {corners.length === 0 ? (
          <p className={styles.empty()}>No inner parts in view.</p>
        ) : (
          <ol className={styles.list()} aria-label="Measured corners">
            {corners.map((corner, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- the measured list has no other identity; it is redrawn whole
              <li key={index} className={styles.entry()} data-mismatch={corner.check.mismatch}>
                <span className={styles.part()}>{`${corner.artboard} · ${corner.part}`}</span>
                <span className={styles.equation()}>{readoutOf(corner)}</span>
                {corner.check.mismatch ? <span className="sr-only">Mismatch</span> : null}
              </li>
            ))}
          </ol>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
