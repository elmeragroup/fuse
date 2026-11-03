"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Check, Copy } from "@elmeragroup/fuse/icons";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { copyText } from "../lib/copy-with-toast";

/** How long a copy button shows that it copied, in ms. */
const COPIED_MS = 2000;

/**
 * The highlighted markup a route serves for a source, fetched once `wanted` turns true, or null
 * while it loads and when it fails, where the plain text stays. Each route's markup is kept once it
 * arrives, so a view that switches between sources fetches each one once. The page's HTML holds
 * the plain text, which the tools that read the source find, so a page of demos parses one text
 * node per demo, and its payload carries no markup: the 36 highlighted sources of the bar-chart
 * page held 40,000 of its 46,700 nodes and 3 MB of its payload.
 *
 * @param href - The route that serves the highlighted markup.
 * @param wanted - Whether the source shows, which starts the fetch.
 * @returns The markup, or null until it arrives.
 */
export function useHighlightedSource(href: string, wanted: boolean): string | null {
  const [markup, setMarkup] = useState<ReadonlyMap<string, string>>(new Map());
  const known = markup.has(href);
  useEffect(() => {
    if (known || !wanted) return;
    const controller = new AbortController();
    fetch(href, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : null))
      .then((html) => {
        if (html !== null) setMarkup((current) => new Map(current).set(href, html));
      })
      // A failed fetch keeps the plain text, which is still the whole source.
      .catch(() => undefined);
    return () => controller.abort();
  }, [href, known, wanted]);
  return markup.get(href) ?? null;
}

/** What the last copy did: nothing yet, copied, or failed because the page has no clipboard. */
type CopyState = "idle" | "copied" | "failed";

type CopySourceButtonProps = {
  /** The source the button writes to the clipboard. */
  sourceText: string;
  /** The button's name until it copies, when it says "Copied". */
  label: string;
  /** What the live region says once the copy happened. */
  copiedStatus: string;
  /** Whether the button is an item of the enclosing Fuse Toolbar. */
  toolbar?: boolean;
};

/**
 * Copies a source to the clipboard. The button turns into a check and says "Copied" while the copy
 * shows, and a polite live region tells a screen reader that the copy happened, or that it could
 * not, as where the page has no clipboard.
 */
export function CopySourceButton({
  sourceText,
  label,
  copiedStatus,
  toolbar = false,
}: CopySourceButtonProps): ReactElement {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copy(): Promise<void> {
    setState((await copyText(sourceText)) ? "copied" : "failed");
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState("idle"), COPIED_MS);
  }

  const name = state === "copied" ? "Copied" : label;
  const icon = state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />;
  return (
    <>
      {toolbar ? (
        <Toolbar.Button
          onClick={() => void copy()}
          render={<Button variant="ghost" size="icon-xs" aria-label={name} />}>
          {icon}
        </Toolbar.Button>
      ) : (
        <Button variant="ghost" size="icon-xs" aria-label={name} onClick={() => void copy()}>
          {icon}
        </Button>
      )}
      <span role="status" className="sr-only">
        {state === "idle" ? "" : state === "copied" ? copiedStatus : "Could not copy the code"}
      </span>
    </>
  );
}
