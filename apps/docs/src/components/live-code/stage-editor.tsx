"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { tv } from "tailwind-variants";

import { ArrowsClockwise, Check, Copy } from "@elmeragroup/fuse/icons";

import { copyText } from "../../lib/copy-with-toast";
import { editedSource } from "../../lib/live-code/edits";
import type { FrameEdits, PropValue } from "../../lib/live-code/edits";
import { paddingBox, ringBox } from "../../lib/live-code/outline";
import type { Clipper, RingBox } from "../../lib/live-code/outline";
import { allowedValues } from "../../lib/live-code/schema";
import type { PropSpec } from "../../lib/live-code/schema";
import { findSites } from "../../lib/live-code/sites";
import type { Site } from "../../lib/live-code/sites";
import type { LiveCodeStore, LiveSite, SiteValue } from "../../lib/live-code/store";
import { ExpandableMenu } from "./expandable-menu";

const stageEditor = tv({
  slots: {
    title: "truncate font-mono",
    notice: "text-xs shrink-0 px-2 pb-1 text-muted-foreground empty:hidden",
    defaultMark: "ms-auto font-sans text-muted-foreground",
    copyIcons: "inline-grid size-4 shrink-0",
    copyIcon: "landing-icon-swap col-start-1 row-start-1",
    // The outline layer sits at the slot's origin, so its boxes take the parts' rects less its
    // own. Each box's ring is drawn in `styles/globals.css`.
    outline:
      "ease-out pointer-events-none absolute top-0 left-0 z-10 opacity-0 transition-opacity duration-120 data-shown:opacity-100",
  },
});

const styles = stageEditor();

const NO_ELEMENTS: readonly Element[] = [];

/** The value the stage renders a prop with, or `mixed`; a prop no instance sets shows its default. */
function shownValue(live: LiveSite, spec: PropSpec): SiteValue {
  const value = live.values.get(spec.name) ?? { kind: "one", value: undefined };
  return value.kind === "one" && value.value === undefined ? { kind: "one", value: spec.default } : value;
}

/** The props a site passes: those its source writes, and those the reader set. */
function passedProps(site: Site | undefined, edits: FrameEdits, loc: string): ReadonlySet<string> {
  return new Set([
    ...(site?.attributes.map((attribute) => attribute.name) ?? []),
    ...(edits.get(loc)?.keys() ?? []),
  ]);
}

type StageEditorProps = {
  /** The frame's store, shared with its stage and its Code view. */
  store: LiveCodeStore;
  /** The Demo view's element, which holds the stage. */
  host: HTMLElement;
  /** The slot in the frame's footer the stage control and the part outline portal into. */
  slot: HTMLElement;
  /** The demo's source, which Copy writes with the edits. */
  sourceText: string;
};

/**
 * Live code's stage editor: the stage control, a round ghost button at the inline start of the demo
 * frame's footer, and its menu, an `ExpandableMenu` of every site on the stage with a prop to set,
 * in source order, which grows down from the control, below the stage, so the stage it edits stays
 * in view; it grows up over the stage only where five rows don't fit below.
 * Highlighting a value previews it on the stage, choosing one commits it, and the Code view, Copy
 * and the Sheet carry the committed edits.
 *
 * A stage with one site opens straight onto its props, headed with its part. With several, as
 * repeated parts or a demo's popup parts, each site's rows sit under its part and source line, and
 * highlighting a row outlines that site's elements on the stage. A part inside a closed popup keeps
 * its rows; its edits apply when the popup opens.
 */
export function StageEditor({ store, host, slot, sourceText }: StageEditorProps): ReactElement | null {
  const sites = useSyncExternalStore(store.subscribeSites, store.getSites, store.getSites);
  const edits = useSyncExternalStore(store.subscribe, store.getEdits, store.getEdits);
  const notice = useSyncExternalStore(store.subscribe, store.getNotice, store.getNotice);
  const sourceSites = useMemo(
    () => new Map(findSites(sourceText).map((site) => [site.loc, site])),
    [sourceText]
  );
  // Every rendered site, in source order.
  const live = useMemo(
    () =>
      [...sourceSites.keys()].flatMap((loc) => {
        const site = sites.get(loc);
        return site === undefined ? [] : [site];
      }),
    [sourceSites, sites]
  );
  // The site whose row is highlighted, and the one outlined, which stays to fade out.
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [outlined, setOutlined] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // The sites snapshot keeps each site's elements until a site changes, so the outline measures
  // again only then.
  const outlinedElements = sites.get(outlined ?? "")?.elements ?? NO_ELEMENTS;

  const [only] = live;
  if (only === undefined) return null;
  const grouped = live.length > 1;
  const highlight = (loc: string | null): void => {
    setHighlighted(loc);
    if (loc !== null) setOutlined(loc);
  };

  async function copy(): Promise<void> {
    const source = editedSource(sourceText, [...sourceSites.values()], store.getEdits());
    setCopied((await copyText(source)) ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied("idle"), 2000);
  }

  return createPortal(
    <>
      <ExpandableMenu.Root
        onOpenChange={(open) => {
          if (open) return;
          store.preview(null);
          highlight(null);
        }}
        onOpenChangeComplete={(open) => {
          if (!open) setOutlined(null);
        }}>
        <ExpandableMenu.Trigger aria-label="Edit props" />
        <ExpandableMenu.Popup
          aria-label="Edit props"
          header={grouped ? "All parts" : <span className={styles.title()}>{`<${only.part}>`}</span>}
          // Focus follows the highlight. Every focus in the menu clears the outlined site first,
          // and a site's group, around its rows and their submenus, then names it again.
          onFocusCapture={() => highlight(null)}>
          {/* A live region from the menu's first frame, so a value the stage rejects is announced. */}
          <p role="status" className={styles.notice()}>
            {notice}
          </p>
          {grouped ? (
            live.map((site, index) => (
              <ExpandableMenu.Group key={site.loc} onFocus={() => highlight(site.loc)}>
                {index === 0 ? null : <ExpandableMenu.Separator />}
                {/* The source line tells apart the groups of one part, such as a menu's items. */}
                <ExpandableMenu.GroupLabel>{`<${site.part}> · line ${site.loc.split(":")[0] ?? ""}`}</ExpandableMenu.GroupLabel>
                <SiteRows site={site} store={store} source={sourceSites.get(site.loc)} edits={edits} />
              </ExpandableMenu.Group>
            ))
          ) : (
            <SiteRows site={only} store={store} source={sourceSites.get(only.loc)} edits={edits} />
          )}
          <ExpandableMenu.Separator />
          <ExpandableMenu.Item onClick={() => void copy()}>
            {/* Both icons stay mounted in one cell, so Copied swaps them both ways. */}
            <span aria-hidden className={styles.copyIcons()}>
              <Check data-shown={String(copied === "copied")} className={styles.copyIcon()} />
              <Copy
                data-shown={String(copied !== "copied")}
                className={styles.copyIcon({ className: "text-muted-foreground" })}
              />
            </span>
            <span className="flex-1">
              {copied === "copied" ? "Copied" : copied === "failed" ? "Could not copy" : "Copy code"}
            </span>
          </ExpandableMenu.Item>
          <ExpandableMenu.Item disabled={edits.size === 0} onClick={() => store.clear()}>
            <ArrowsClockwise aria-hidden className="text-muted-foreground" />
            Reset
          </ExpandableMenu.Item>
        </ExpandableMenu.Popup>
      </ExpandableMenu.Root>
      {outlined === null ? null : (
        <PartOutline store={store} host={host} elements={outlinedElements} shown={highlighted !== null} />
      )}
    </>,
    slot
  );
}

/** One outlined element's ring, with its element's radius. */
type OutlineBox = RingBox & { readonly radius: string };

/** How far the ring reaches past its box: its 2px offset and 1.5px width, rounded up. */
const RING_REACH = 4;

/**
 * An element's clipping ancestors, up to and including `host`: each one whose overflow clips an
 * axis, with its padding box in viewport px, scaled with any transform on it or above it.
 */
function clippersOf(element: Element, host: Element): Clipper[] {
  const clippers: Clipper[] = [];
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const style = getComputedStyle(node);
    const x = style.overflowX !== "visible";
    const y = style.overflowY !== "visible";
    if (x || y) {
      const at = node.getBoundingClientRect();
      // An SVG element has no offset metrics, and clips to its own box.
      const box =
        node instanceof HTMLElement
          ? paddingBox(at, node)
          : { left: at.left, top: at.top, right: at.right, bottom: at.bottom };
      clippers.push({ box, x, y });
    }
    if (node === host) break;
  }
  return clippers;
}

type PartOutlineProps = {
  /** The frame's store, whose previews and edits can move the elements. */
  store: LiveCodeStore;
  /** The Demo view, whose reflow moves the elements. */
  host: HTMLElement;
  /** The highlighted site's mounted elements. */
  elements: readonly Element[];
  /** Whether a row of the site is highlighted; the outline fades out once none is. */
  shown: boolean;
};

/**
 * Rings around the highlighted site's elements, so the reader sees which part they edit. It is
 * drawn in the editor's own layer from the elements' rects and never touches the demo's markup.
 * Each ring follows what the reader sees of its element (`lib/live-code/outline.ts`): an element
 * its ancestors clip whole, such as a list's overscan row, or one with an empty rect, as in a
 * closed popup, gets none, one they clip in part is ringed where it shows, and no ring paints past
 * the region they clip to.
 */
function PartOutline({ store, host, elements, shown }: PartOutlineProps): ReactElement {
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<readonly OutlineBox[]>([]);
  const measure = useCallback((): void => {
    const origin = layer.current?.getBoundingClientRect();
    if (origin === undefined) return;
    setBoxes(
      elements.flatMap((element) => {
        const ring = ringBox(element.getBoundingClientRect(), clippersOf(element, host), origin, RING_REACH);
        return ring === null ? [] : [{ ...ring, radius: getComputedStyle(element).borderRadius }];
      })
    );
  }, [host, elements]);
  // A preview resizes the site's elements, and a reflow of the stage moves them.
  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [measure, host, elements]);
  // A scroll, or a preview or edit such as an `align` that moves a part, can move the elements
  // without resizing them: while the outline shows, either measures again in the next frame, after
  // React has committed the change, once per frame.
  useEffect(() => {
    if (!shown) return;
    let frame = 0;
    const schedule = (): void => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    const unsubscribe = store.subscribe(schedule);
    return () => {
      document.removeEventListener("scroll", schedule, { capture: true });
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [shown, measure, store]);
  return (
    <div
      ref={layer}
      aria-hidden
      data-stage-outline
      data-shown={shown ? "" : undefined}
      className={styles.outline()}>
      {boxes.map((box, index) => (
        <div
          // The boxes follow the elements' order, and carry no identity of their own.
          key={index}
          style={{
            "--outline-x": `${String(box.left)}px`,
            "--outline-y": `${String(box.top)}px`,
            "--outline-width": `${String(box.width)}px`,
            "--outline-height": `${String(box.height)}px`,
            "--outline-radius": box.radius,
            "--outline-clip": box.reach.map((reach) => `${String(-reach)}px`).join(" "),
          }}
        />
      ))}
    </div>
  );
}

type SiteRowsProps = {
  site: LiveSite;
  store: LiveCodeStore;
  source: Site | undefined;
  edits: FrameEdits;
};

/** One site's props: an enum as a submenu of its allowed values, a boolean as a switch. */
function SiteRows({ site, store, source, edits }: SiteRowsProps): ReactElement {
  const passed = passedProps(source, edits, site.loc);
  const rows = site.schema.flatMap((spec) => {
    const value = shownValue(site, spec);
    const current = value.kind === "one" ? value.value : undefined;
    if (spec.kind === "boolean") {
      return [
        <ExpandableMenu.CheckboxItem
          key={spec.name}
          checked={current === true}
          onCheckedChange={(checked: boolean) => store.set(site.loc, spec.name, checked)}>
          {spec.name}
          {value.kind === "mixed" ? <span className={styles.defaultMark()}>mixed</span> : null}
        </ExpandableMenu.CheckboxItem>,
      ];
    }
    const options = allowedValues(spec, passed, current);
    // An enum with no option to offer is left out rather than shown as an empty submenu.
    if (options.length === 0) return [];
    const preview = (option: string | null): void => {
      const value: PropValue | undefined = options.find((candidate) => candidate === option);
      store.preview(value === undefined ? null : { loc: site.loc, prop: spec.name, value });
    };
    return [
      <ExpandableMenu.Submenu
        key={spec.name}
        label={spec.name}
        value={value.kind === "mixed" ? "mixed" : (current ?? "unset")}
        onOpenChange={(next) => {
          if (!next) store.preview(null);
        }}
        onHighlight={preview}>
        <ExpandableMenu.RadioGroup
          value={value.kind === "one" ? (current ?? null) : null}
          // Base UI types the value `any`; the group's items carry the listed options.
          onValueChange={(next: string) => store.set(site.loc, spec.name, next)}>
          {options.map((option) => (
            <ExpandableMenu.RadioItem key={option} value={option}>
              <span className="font-mono">{option}</span>
              {option === spec.default && option !== "default" ? (
                <span className={styles.defaultMark()}>default</span>
              ) : null}
            </ExpandableMenu.RadioItem>
          ))}
        </ExpandableMenu.RadioGroup>
      </ExpandableMenu.Submenu>,
    ];
  });
  return <>{rows}</>;
}
