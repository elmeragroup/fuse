"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowsClockwise, ArrowSquareOut, Lock } from "@elmeragroup/fuse/icons";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { themeSlug } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { BLOCK_THEME_PARAM, encodeBlockPreviewMessage, parseBlockPreviewMessage } from "../lib/block-preview";
import { BLOCK_VIEWPORTS, fitViewport, VIEWPORT_LABELS } from "../lib/block-viewport";
import type { BlockViewport } from "../lib/block-viewport";
import { BlockCode } from "./block-code";
import type { BlockFile } from "./block-code";
import { usePreviewTheme } from "./preview-theme";

/** Below this window width the preview opens on the phone viewport. */
const PHONE_FIRST_BELOW = 560;

const blockPreview = tv({
  slots: {
    // Out of the page's prose; the Tabs keep their own layout and gap.
    root: "not-prose",
    toolbar: "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
    controls: "flex items-center gap-2",
    // The window keeps one height in every viewport and both views, so nothing below it moves.
    height: "h-[46rem] max-h-[calc(100svh-10rem)] min-h-[32rem]",
    window: "shadow-md flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border",
    // Browser chrome is the browser's, never the page's: small, quiet type and a fixed height.
    bar: "flex h-10 shrink-0 items-center gap-1 border-b border-border bg-muted px-3",
    lights: "mr-2 flex shrink-0 gap-1.5",
    light: "size-2.5 rounded-full bg-muted-foreground/25",
    address:
      "text-xs mx-1 flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-background px-2.5 text-muted-foreground",
    addressIcon: "size-3 shrink-0",
    addressText: "min-w-0 truncate tabular-nums",
    // A viewport narrower than the window sits centred on the muted ground, as a device does in a
    // browser's responsive mode.
    stage: "relative min-h-0 flex-1 overflow-hidden bg-muted",
    viewport:
      "group/viewport data-[framed=true]:shadow-sm mx-auto h-full overflow-hidden bg-background data-measured:w-(--viewport-width)",
    frame:
      "block h-full w-full origin-top-left border-0 group-data-measured/viewport:h-(--frame-height) group-data-measured/viewport:w-(--frame-width) group-data-measured/viewport:scale-(--frame-scale)",
  },
});

const styles = blockPreview();

/** The window's inner size, once measured. */
type StageSize = { readonly width: number; readonly height: number };

type BlockPreviewProps = {
  /** The block's name, for the iframe's title and the views' names. */
  title: string;
  /** The block's standalone route, where the iframe opens. */
  src: string;
  /** The block's folder, as its Code view names each file. */
  folder: string;
  /** The block's files, in tree order. */
  files: readonly BlockFile[];
};

/**
 * A block's live preview and its code. The preview is the block's own standalone route in an
 * iframe, framed as a browser window whose address bar shows the block's route and whose reload
 * button reloads the iframe in place. The chrome has no back or forward: the iframe's history is the
 * browser's own, and its Back and Forward already step through it, where a mirror in this page
 * could drift and step the docs page instead. The toggle lays the block out at a desktop, tablet
 * or phone width, scaled to fit the window when the column is narrower, so each width shows the
 * block's own layout for it. The iframe takes the docs header's preview theme; the colour scheme
 * it reads from the docs' storage itself.
 */
export function BlockPreview({ title, src, folder, files }: BlockPreviewProps): ReactElement {
  const { theme } = usePreviewTheme();
  const [view, setView] = useState<"preview" | "code">("preview");
  const [viewport, setViewport] = useState<BlockViewport>("desktop");
  const [size, setSize] = useState<StageSize | undefined>(undefined);
  // Where the iframe is, as it last reported.
  const [path, setPath] = useState(src);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const latestTheme = useRef(theme);

  // The window's inner size. The first measure also picks the phone viewport on a narrow screen,
  // where a scaled desktop would be too small to read.
  useEffect(() => {
    const element = stage.current;
    if (element === null) return;
    let first = true;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      if (first && width < PHONE_FIRST_BELOW) setViewport("phone");
      first = false;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The iframe asks for the theme once its block listens, and reports every path it reaches.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = parseBlockPreviewMessage(event.data);
      if (message?._tag === "Ready") {
        event.source?.postMessage(encodeBlockPreviewMessage({ _tag: "Theme", theme: latestTheme.current }), {
          targetOrigin: window.location.origin,
        });
      }
      if (message?._tag === "Location") {
        setPath(message.path);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Every theme the header picks goes to the iframe.
  useEffect(() => {
    latestTheme.current = theme;
    frame.current?.contentWindow?.postMessage(
      encodeBlockPreviewMessage({ _tag: "Theme", theme }),
      window.location.origin
    );
  }, [theme]);

  const fit = size === undefined ? undefined : fitViewport(viewport, size.width);
  const framed = fit !== undefined && fit.width * fit.scale < (size?.width ?? 0);

  return (
    <div className={styles.root()}>
      <Tabs.Root
        value={view}
        onValueChange={(value: string) => {
          setView(value === "code" ? "code" : "preview");
        }}>
        <div className={styles.toolbar()}>
          <Tabs.List aria-label={`${title} view`}>
            <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
            <Tabs.Trigger value="code">Code</Tabs.Trigger>
          </Tabs.List>
          <div className={styles.controls()}>
            {/* Kept in the layout under the Code view, so the toolbar never reflows. */}
            <ToggleGroup.Root
              aria-label="Viewport"
              size="sm"
              value={[viewport]}
              disabled={view === "code"}
              className={view === "code" ? "invisible" : undefined}
              onValueChange={(value: string[]) => {
                const next = BLOCK_VIEWPORTS.find((candidate) => candidate === value[0]);
                if (next !== undefined) setViewport(next);
              }}>
              {BLOCK_VIEWPORTS.map((candidate) => (
                <ToggleGroup.Item key={candidate} value={candidate}>
                  {VIEWPORT_LABELS[candidate]}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={`${path}?${BLOCK_THEME_PARAM}=${themeSlug(theme)}`} target="_blank" rel="noopener" />
              }>
              {/* On a phone the button keeps its name and shows only its icon, so the row fits. */}
              <span className="max-sm:sr-only">Open in new tab</span>
              <ArrowSquareOut data-icon="inline-end" aria-hidden />
            </Button>
          </div>
        </div>

        <Tabs.Content value="preview" keepMounted>
          {/* The height sits on the window, not on the panel, which is a flexible item of the Tabs. */}
          <div className={styles.window({ className: styles.height() })}>
            <div className={styles.bar()}>
              <span aria-hidden className={styles.lights()}>
                <span className={styles.light()} />
                <span className={styles.light()} />
                <span className={styles.light()} />
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Reload"
                onClick={() => {
                  // Reloads the iframe's current entry in place, which adds no history entry.
                  frame.current?.contentWindow?.location.reload();
                }}>
                <ArrowsClockwise aria-hidden />
              </Button>
              <div className={styles.address()}>
                <Lock aria-hidden className={styles.addressIcon()} />
                <span className={styles.addressText()}>
                  <span className="sr-only">Address: </span>
                  <span>{path}</span>
                </span>
              </div>
            </div>
            <div ref={stage} className={styles.stage()}>
              {/* The measured fit goes in as custom properties, which the classes read only once
                it is known: before that the iframe fills the window at 1:1. */}
              <div
                className={styles.viewport()}
                data-framed={framed}
                data-measured={fit === undefined ? undefined : true}
                style={
                  fit === undefined || size === undefined
                    ? undefined
                    : {
                        "--viewport-width": `${String(fit.width * fit.scale)}px`,
                        "--frame-width": `${String(fit.width)}px`,
                        "--frame-height": `${String(size.height / fit.scale)}px`,
                        "--frame-scale": String(fit.scale),
                      }
                }>
                <iframe ref={frame} src={src} title={`${title} preview`} className={styles.frame()} />
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="code" keepMounted>
          <BlockCode folder={folder} files={files} active={view === "code"} className={styles.height()} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
