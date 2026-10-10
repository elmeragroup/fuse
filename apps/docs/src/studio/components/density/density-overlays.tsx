"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { tv } from "tailwind-variants";

import { DENSITY_ROLES } from "@elmeragroup/fuse/theme-catalog";
import type { DensityRole } from "@elmeragroup/fuse/theme-catalog";
import { Toggle } from "@elmeragroup/fuse/toggle";

import { FUSE_PART_ROLES, resolvePartRole } from "../../lib/density-parts";
import type { InspectedPart, PartRole } from "../../lib/density-parts";
import { DENSITY_TWINS } from "../../lib/documents";
import { childGaps, formatPx, paddingBands } from "../../lib/measure";
import type { Band, Box } from "../../lib/measure";
import { ChromeScope } from "../chrome-scope";
import { useStudioEdits } from "../studio-edits";
import { isOverlayShortcut } from "../studio-shortcuts";
import { useViewportCommands, useViewportState } from "../studio-viewport";
import { useDensityView } from "./density-view";

const densityOverlays = tv({
  slots: {
    // Screen space: above the world, below the floating bars, and never in the pointer's way.
    layer: "pointer-events-none absolute inset-0 z-20 overflow-hidden",
    // Each drawn box sits at its `--x`, `--y`, `--w` and `--h` in canvas px.
    tint: "absolute top-(--y) left-(--x) h-(--h) w-(--w) outline-1 -outline-offset-1",
    link: "absolute top-(--y) left-(--x) h-(--h) w-(--w) outline-2 -outline-offset-1 outline-primary",
    measured: "absolute top-(--y) left-(--x) h-(--h) w-(--w) outline-1 -outline-offset-1 outline-destructive",
    padding: "absolute top-(--y) left-(--x) h-(--h) w-(--w) bg-destructive/15",
    gap: "absolute top-(--y) left-(--x) h-(--h) w-(--w) bg-info/25",
    // A label centred on its point, on a solid chip so it reads over any artboard.
    size: "text-xs absolute top-(--y) left-(--x) -translate-1/2 rounded-sm bg-destructive px-1 py-px font-mono whitespace-nowrap text-destructive-foreground tabular-nums",
    bandTag:
      "text-xs absolute top-(--y) left-(--x) -translate-1/2 rounded-sm bg-popover px-1 py-px font-mono whitespace-nowrap text-popover-foreground tabular-nums",
    roleTag:
      "text-xs shadow-sm absolute top-(--y) left-(--x) -translate-y-full rounded-sm bg-popover px-1 py-px font-mono whitespace-nowrap text-popover-foreground",
    bar: "shadow-lg absolute top-3 left-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground",
    legend: "flex flex-wrap items-center gap-1",
    chip: "gap-1.5",
    swatch: "size-2.5 shrink-0 rounded-full",
  },
  // One tint per density role, from the status roles and the chrome's primary and muted text:
  // a brand's chart roles can be one hue ramp, too close to tell six roles apart.
  variants: {
    role: {
      control: { tint: "bg-info/20 outline-info", swatch: "bg-info" },
      row: { tint: "bg-success/20 outline-success", swatch: "bg-success" },
      surface: { tint: "bg-warning/15 outline-warning", swatch: "bg-warning" },
      label: { tint: "bg-error/20 outline-error", swatch: "bg-error" },
      layout: { tint: "bg-primary/10 outline-primary", swatch: "bg-primary" },
      fixed: { tint: "bg-muted-foreground/10 outline-muted-foreground", swatch: "bg-muted-foreground" },
    },
    hovered: {
      true: { tint: "outline-2" },
    },
  },
});

const styles = densityOverlays();

/** A part the X-ray tints. */
type TintedPart = {
  readonly id: string;
  readonly box: Box;
  readonly role: DensityRole;
  readonly hovered: boolean;
};

/** What the measure overlay draws for one element. */
type Measurement = {
  readonly box: Box;
  readonly width: number;
  readonly height: number;
  readonly padding: readonly Band[];
  readonly gaps: readonly Band[];
};

/** Everything the overlays draw in one frame, in canvas screen px. */
type Frame = {
  readonly tinted: readonly TintedPart[];
  /** The pointed part and its twin. */
  readonly link: { readonly pointed: Box; readonly twin: Box } | undefined;
  readonly measurement: Measurement | undefined;
  readonly tag: { readonly box: Box; readonly text: string } | undefined;
};

const EMPTY_FRAME: Frame = { tinted: [], link: undefined, measurement: undefined, tag: undefined };

/** The parts of a stage, in document order. */
const PART = "[data-slot]";

const ARTBOARD = "[data-artboard-id]";

/** The events that start a transition or keyframe animation, which wake the overlays to follow it. */
const MOTION_STARTS = ["transitionrun", "animationstart"] as const;

/** The anchors the twin composition marks, so a part keeps its identity across the twins. */
const TWIN_ANCHOR = "[data-twin-id]";

/** Each artboard's parts in document order, with their roles. */
type PartCache = Map<Element, ReadonlyMap<Element, PartRole | undefined>>;

/** The element's part inside an artboard's stage: its nearest `data-slot` within the stage. */
function partAt(target: Element): { part: Element; stage: Element } | undefined {
  const stage = target.closest("[data-demo-stage]");
  const part = target.closest(PART);
  return stage !== null && part !== null && stage.contains(part) ? { part, stage } : undefined;
}

/** A part's role, from Fuse's part table and the selectors its override keys add. */
function resolveRole(part: Element): PartRole | undefined {
  const slot = part.getAttribute("data-slot") ?? "";
  return resolvePartRole(FUSE_PART_ROLES, slot, (suffix) => part.matches(`[data-slot="${slot}"]${suffix}`));
}

/**
 * An artboard's parts and their roles, discovered once. The cache drops an artboard when its
 * subtree changes and every artboard on an edit.
 */
function partsOf(cache: PartCache, artboard: Element): ReadonlyMap<Element, PartRole | undefined> {
  const cached = cache.get(artboard);
  if (cached !== undefined) {
    return cached;
  }
  const parts = new Map(
    Array.from(
      artboard.querySelectorAll(`[data-demo-stage] ${PART}`),
      (part) => [part, resolveRole(part)] as const
    )
  );
  cache.set(artboard, parts);
  return parts;
}

/** A part's role, as the cache holds it. */
function roleOf(cache: PartCache, part: Element): PartRole | undefined {
  const artboard = part.closest(ARTBOARD);
  return artboard === null ? undefined : partsOf(cache, artboard).get(part);
}

/** The part the inspector describes: its slot, role and artboard. */
function inspectedOf(cache: PartCache, part: Element): InspectedPart | undefined {
  const role = roleOf(cache, part);
  const artboard = part.closest(ARTBOARD)?.getAttribute("data-artboard-id");
  return role === undefined || artboard === undefined || artboard === null
    ? undefined
    : { ...role, slot: part.getAttribute("data-slot") ?? "", artboard };
}

/** A twin's stage, by the twin artboard's id. */
function twinStage(id: string): Element | null {
  return document.querySelector(`[data-artboard-id="${id}"] [data-demo-stage]`);
}

/**
 * The same part in the other twin: the part at the same index among the parts of the same twin
 * anchor. An anchor bounds the effect of state one twin alone has, such as a closed Accordion
 * item, which unmounts its content in that twin only.
 */
function twinOf(part: Element, stage: Element): Element | undefined {
  const artboard = stage.closest(ARTBOARD)?.getAttribute("data-artboard-id");
  const otherId = DENSITY_TWINS.find((id) => id !== artboard);
  const anchor = part.closest(TWIN_ANCHOR);
  if (otherId === undefined || !DENSITY_TWINS.some((id) => id === artboard) || anchor === null) {
    return undefined;
  }
  const index = part === anchor ? -1 : Array.from(anchor.querySelectorAll(PART)).indexOf(part);
  const otherAnchor = twinStage(otherId)?.querySelector(
    `[data-twin-id="${anchor.getAttribute("data-twin-id") ?? ""}"]`
  );
  const twin = index === -1 ? otherAnchor : otherAnchor?.querySelectorAll(PART).item(index);
  if (twin === null || twin === undefined) {
    return undefined;
  }
  return twin.getAttribute("data-slot") === part.getAttribute("data-slot") ? twin : undefined;
}

function boxIn(element: Element, origin: DOMRect): Box {
  const rect = element.getBoundingClientRect();
  return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
}

/** Screen px per CSS px for an element inside an artboard: its board's drawn width over its width. */
function scaleOf(element: Element): number {
  const board = element.closest<HTMLElement>("[data-demo-stage]");
  if (board === null || board.offsetWidth === 0) {
    return 1;
  }
  return board.getBoundingClientRect().width / board.offsetWidth;
}

function measure(element: Element, origin: DOMRect): Measurement {
  const scale = scaleOf(element);
  const box = boxIn(element, origin);
  const style = getComputedStyle(element);
  const padding = paddingBands(
    box,
    {
      padding: {
        top: Number.parseFloat(style.paddingTop),
        right: Number.parseFloat(style.paddingRight),
        bottom: Number.parseFloat(style.paddingBottom),
        left: Number.parseFloat(style.paddingLeft),
      },
      border: {
        top: Number.parseFloat(style.borderTopWidth),
        right: Number.parseFloat(style.borderRightWidth),
        bottom: Number.parseFloat(style.borderBottomWidth),
        left: Number.parseFloat(style.borderLeftWidth),
      },
    },
    scale
  );
  const children = Array.from(element.children).filter((child) => {
    const position = getComputedStyle(child).position;
    const rect = child.getBoundingClientRect();
    return position !== "absolute" && position !== "fixed" && rect.width > 0 && rect.height > 0;
  });
  return {
    box,
    width: box.width / scale,
    height: box.height / scale,
    padding,
    gaps: childGaps(
      children.map((child) => boxIn(child, origin)),
      scale
    ),
  };
}

/** Whether a box in canvas px overlaps the canvas. */
function onCanvas(box: Box, origin: DOMRect): boolean {
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.x < origin.width &&
    box.y < origin.height &&
    box.x + box.width > 0 &&
    box.y + box.height > 0
  );
}

/**
 * Every visible part on the page's artboards with its role, skipping hidden roles. Artboards
 * outside the canvas cost one measurement and draw nothing.
 */
function tint(
  canvas: Element,
  cache: PartCache,
  origin: DOMRect,
  hidden: ReadonlySet<DensityRole>,
  hovered: Element | undefined
): TintedPart[] {
  return Array.from(canvas.querySelectorAll(ARTBOARD)).flatMap((artboard, board) => {
    if (!onCanvas(boxIn(artboard, origin), origin)) {
      return [];
    }
    return Array.from(partsOf(cache, artboard)).flatMap(([part, resolved], index) => {
      const role = resolved?.role;
      if (role === undefined || hidden.has(role)) {
        return [];
      }
      const box = boxIn(part, origin);
      return onCanvas(box, origin)
        ? [{ id: `${String(board)}-${String(index)}`, box, role, hovered: part === hovered }]
        : [];
    });
  });
}

function px(value: number): string {
  return `${String(value)}px`;
}

/** The canvas is attached once its section mounts; nothing else changes it. */
const subscribeNever = (): (() => void) => () => undefined;

const ROLE_LABELS = {
  control: "Control",
  row: "Row",
  surface: "Surface",
  label: "Label",
  layout: "Layout",
  fixed: "Fixed",
} as const satisfies Record<DensityRole, string>;

/** The canvas bar: the two overlay toggles, and the X-ray legend whose chips show or hide a role. */
function OverlayBar(): ReactElement {
  const { measure: measuring, setMeasure, xray, setXray, hiddenRoles, setRoleShown } = useDensityView();
  return (
    <ChromeScope className={styles.bar()} data-canvas-overlay>
      <Toggle variant="outline" size="sm" pressed={measuring} onPressedChange={setMeasure}>
        Measure (M)
      </Toggle>
      <Toggle variant="outline" size="sm" pressed={xray} onPressedChange={setXray}>
        Role X-ray (R)
      </Toggle>
      {xray ? (
        <div role="group" aria-label="Roles shown" className={styles.legend()}>
          {DENSITY_ROLES.map((role) => (
            <Toggle
              key={role}
              size="sm"
              className={styles.chip()}
              pressed={!hiddenRoles.has(role)}
              onPressedChange={(shown) => {
                setRoleShown(role, shown);
              }}>
              <span aria-hidden className={styles.swatch({ role })} />
              {ROLE_LABELS[role]}
            </Toggle>
          ))}
        </div>
      ) : null}
    </ChromeScope>
  );
}

/**
 * The Density page's canvas overlays, drawn in screen space over the world so they stay crisp
 * at any zoom:
 *
 * - The twin link: the part under the pointer in one twin, and the same part in the other.
 * - Measure (M, or while Alt is held): the hovered element's box with its size, its padding and
 *   the gaps between its children.
 * - Role X-ray (R): every part tinted by its density role.
 *
 * The layer is `aria-hidden`; the inspector describes the hovered or focused part in text.
 *
 * Nothing is measured while the page is idle. A draw is scheduled when the camera, an edit, the
 * canvas size, an artboard's subtree, a scroll inside an artboard, a web font load or the pointed
 * element changes, and the overlays sample every frame only while a glide, or a transition or
 * keyframe animation inside an artboard, runs.
 */
export function DensityOverlays(): ReactElement | null {
  const { canvas } = useViewportCommands();
  const { measure: measuring, xray, hiddenRoles, setMeasure, setXray, inspect } = useDensityView();
  // The canvas attaches in the commit after this page first renders; the store re-reads it then.
  const host = useSyncExternalStore(subscribeNever, canvas, () => null);
  const { viewport, gliding } = useViewportState();
  const { overrides } = useStudioEdits();
  const [frame, setFrame] = useState<Frame>(EMPTY_FRAME);
  const [altHeld, setAltHeld] = useState(false);
  const pointed = useRef<Element | null>(null);
  const [cache] = useState<PartCache>(() => new Map());
  // Requests a draw in the next animation frame; the draw effect installs it.
  const schedule = useRef<() => void>(() => undefined);
  const glidingNow = useRef(gliding);
  const measureOn = measuring || altHeld;
  // What the overlays draw. The draw reads it at each frame, so an option change redraws without
  // restarting the scheduler, which would forget the motion it is following.
  const options = useRef({ xray, hiddenRoles, measureOn });

  // Where the pointer is, and the part the inspector describes: the hovered or focused one.
  useEffect(() => {
    if (host === null) {
      return undefined;
    }
    const describe = (target: EventTarget | null) => {
      const found = target instanceof Element ? partAt(target) : undefined;
      const part = found === undefined ? undefined : inspectedOf(cache, found.part);
      if (part !== undefined) {
        inspect(part);
      }
    };
    const point = (target: Element | null) => {
      if (target !== pointed.current) {
        pointed.current = target;
        schedule.current();
      }
    };
    const onMove = (event: PointerEvent) => {
      point(event.target instanceof Element ? event.target : null);
      describe(event.target);
    };
    const onLeave = () => {
      point(null);
    };
    const onFocus = (event: FocusEvent) => {
      describe(event.target);
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("focusin", onFocus);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("focusin", onFocus);
    };
  }, [host, cache, inspect]);

  // M and R toggle the overlays; Alt measures while it is held.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setAltHeld(true);
      } else if (isOverlayShortcut(event, "m")) {
        setMeasure(!measuring);
      } else if (isOverlayShortcut(event, "r")) {
        setXray(!xray);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setAltHeld(false);
      }
    };
    const release = () => {
      setAltHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, [measuring, xray, setMeasure, setXray]);

  // A draw re-reads the boxes and React re-renders only when what the overlays draw changes.
  useEffect(() => {
    if (host === null) {
      return undefined;
    }
    let last = "";
    let request = 0;
    const inArtboard = (node: Node): Element | null =>
      (node instanceof Element ? node : node.parentElement)?.closest(ARTBOARD) ?? null;
    // Whether a transition or keyframe animation inside an artboard is under way, such as an
    // Accordion opening or a Select popup scaling in. The live list also holds motion that started
    // before this effect subscribed, or that no start event announced. A paused one counts until
    // it finishes, since resuming it sends no event.
    const moving = () =>
      host.getAnimations({ subtree: true }).some((animation) => {
        const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
        return (
          (animation.playState === "running" || animation.playState === "paused") &&
          target !== null &&
          inArtboard(target) !== null
        );
      });
    const draw = () => {
      request = 0;
      const { xray, hiddenRoles, measureOn } = options.current;
      const origin = host.getBoundingClientRect();
      const target = pointed.current;
      const found = target === null || !target.isConnected ? undefined : partAt(target);
      const twin = found === undefined ? undefined : twinOf(found.part, found.stage);
      const role = xray && found !== undefined ? roleOf(cache, found.part) : undefined;
      const next: Frame = {
        tinted: xray ? tint(host, cache, origin, hiddenRoles, found?.part) : [],
        link:
          twin === undefined || found === undefined
            ? undefined
            : { pointed: boxIn(found.part, origin), twin: boxIn(twin, origin) },
        measurement:
          measureOn && target !== null && found !== undefined ? measure(target, origin) : undefined,
        tag:
          role === undefined || found === undefined
            ? undefined
            : { box: boxIn(found.part, origin), text: `${role.key} · ${role.role}` },
      };
      const signature = JSON.stringify(next);
      if (signature !== last) {
        last = signature;
        setFrame(next);
      }
      if (glidingNow.current || moving()) {
        request = requestAnimationFrame(draw);
      }
    };
    const requestDraw = () => {
      if (request === 0) {
        request = requestAnimationFrame(draw);
      }
    };
    schedule.current = requestDraw;

    const mutations = new MutationObserver((records) => {
      let changed = false;
      for (const record of records) {
        const artboard = inArtboard(record.target);
        if (artboard !== null) {
          cache.delete(artboard);
          changed = true;
        }
      }
      if (changed) {
        requestDraw();
      }
    });
    mutations.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    const resizes = new ResizeObserver(requestDraw);
    resizes.observe(host);
    for (const artboard of host.querySelectorAll(ARTBOARD)) {
      resizes.observe(artboard);
    }
    // A scroll or a motion start inside an artboard. Scroll events do not bubble; capturing sees a
    // Select list or a Dialog body scrolling.
    const onArtboardEvent = (event: Event) => {
      if (event.target instanceof Element && inArtboard(event.target) !== null) {
        requestDraw();
      }
    };
    for (const type of MOTION_STARTS) {
      host.addEventListener(type, onArtboardEvent);
    }
    host.addEventListener("scroll", onArtboardEvent, { capture: true });
    // A web font that finishes loading reflows the parts under the drawn boxes.
    document.fonts.addEventListener("loadingdone", requestDraw);
    requestDraw();
    return () => {
      schedule.current = () => undefined;
      cancelAnimationFrame(request);
      mutations.disconnect();
      resizes.disconnect();
      for (const type of MOTION_STARTS) {
        host.removeEventListener(type, onArtboardEvent);
      }
      host.removeEventListener("scroll", onArtboardEvent, { capture: true });
      document.fonts.removeEventListener("loadingdone", requestDraw);
    };
  }, [host, cache]);

  useEffect(() => {
    options.current = { xray, hiddenRoles, measureOn };
    schedule.current();
  }, [xray, hiddenRoles, measureOn]);

  // A camera move draws once; a glide samples every frame until it lands.
  useEffect(() => {
    glidingNow.current = gliding;
    schedule.current();
  }, [viewport, gliding]);

  // An edit can change any part's size, so every artboard is discovered afresh.
  useEffect(() => {
    cache.clear();
    schedule.current();
  }, [cache, overrides]);

  if (host === null) {
    return null;
  }
  const { link, measurement, tag } = frame;
  return createPortal(
    <>
      <ChromeScope aria-hidden className={styles.layer()} data-density-overlay>
        {frame.tinted.map((part) => (
          <div
            key={part.id}
            className={styles.tint({ role: part.role, hovered: part.hovered })}
            style={{
              "--x": px(part.box.x),
              "--y": px(part.box.y),
              "--w": px(part.box.width),
              "--h": px(part.box.height),
            }}
            data-xray-role={part.role}
            data-hovered={part.hovered || undefined}
          />
        ))}
        {link === undefined ? null : (
          <>
            <div
              className={styles.link()}
              style={{
                "--x": px(link.pointed.x),
                "--y": px(link.pointed.y),
                "--w": px(link.pointed.width),
                "--h": px(link.pointed.height),
              }}
              data-twin-link="pointed"
            />
            <div
              className={styles.link()}
              style={{
                "--x": px(link.twin.x),
                "--y": px(link.twin.y),
                "--w": px(link.twin.width),
                "--h": px(link.twin.height),
              }}
              data-twin-link="twin"
            />
          </>
        )}
        {measurement === undefined ? null : (
          <>
            {measurement.padding.map((band) => (
              <div
                key={`padding-${String(band.box.x)}-${String(band.box.y)}`}
                className={styles.padding()}
                style={{
                  "--x": px(band.box.x),
                  "--y": px(band.box.y),
                  "--w": px(band.box.width),
                  "--h": px(band.box.height),
                }}
              />
            ))}
            {measurement.gaps.map((band) => (
              <div
                key={`gap-${String(band.box.x)}-${String(band.box.y)}`}
                className={styles.gap()}
                style={{
                  "--x": px(band.box.x),
                  "--y": px(band.box.y),
                  "--w": px(band.box.width),
                  "--h": px(band.box.height),
                }}
              />
            ))}
            <div
              className={styles.measured()}
              style={{
                "--x": px(measurement.box.x),
                "--y": px(measurement.box.y),
                "--w": px(measurement.box.width),
                "--h": px(measurement.box.height),
              }}
            />
            {[
              ...measurement.padding.map((band) => ({ kind: "padding", band })),
              ...measurement.gaps.map((band) => ({ kind: "gap", band })),
            ].map(({ kind, band }) => (
              <span
                key={`${kind}-tag-${String(band.box.x)}-${String(band.box.y)}`}
                className={styles.bandTag()}
                style={{
                  "--x": px(band.box.x + band.box.width / 2),
                  "--y": px(band.box.y + band.box.height / 2),
                }}
                data-measure={kind}>
                {formatPx(band.px)}
              </span>
            ))}
            <span
              className={styles.size()}
              style={{
                "--x": px(measurement.box.x + measurement.box.width / 2),
                "--y": px(measurement.box.y + measurement.box.height + 10),
              }}
              data-measure="width">
              {formatPx(measurement.width)}
            </span>
            <span
              className={styles.size()}
              style={{
                "--x": px(measurement.box.x + measurement.box.width + 14),
                "--y": px(measurement.box.y + measurement.box.height / 2),
              }}
              data-measure="height">
              {formatPx(measurement.height)}
            </span>
          </>
        )}
        {tag === undefined ? null : (
          <span
            className={styles.roleTag()}
            style={{ "--x": px(tag.box.x), "--y": px(tag.box.y - 4) }}
            data-xray-tag>
            {tag.text}
          </span>
        )}
      </ChromeScope>
      <OverlayBar />
    </>,
    host
  );
}
