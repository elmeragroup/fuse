import { Suspense, use } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToReadableStream } from "react-dom/server";
import { afterEach } from "vitest";

/** The server's fallback for the streamed boundary, which hydration must leave in place. */
export const STREAMED_FALLBACK_TEXT = "Streaming";

export type StreamedPage = {
  /** The hydrated host, holding the shell the server streamed first. */
  host: HTMLDivElement;
  /** Every error React reported through `onRecoverableError`, such as a hydration mismatch. */
  recoverableErrors: unknown[];
  /**
   * Lets the boundary's content finish on the server, then appends the rest of the stream and
   * runs its inline scripts, as a browser does when the segment arrives.
   */
  finishStreaming: () => Promise<void>;
};

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

async function readUntil(
  reader: ReadableStreamDefaultReader<unknown>,
  done: (html: string) => boolean
): Promise<string> {
  const decoder = new TextDecoder();
  let html = "";
  while (!done(html)) {
    const chunk = await reader.read();
    if (chunk.done) {
      return html + decoder.decode();
    }
    if (!(chunk.value instanceof Uint8Array)) {
      throw new TypeError("React's stream enqueued a chunk that is not bytes");
    }
    html += decoder.decode(chunk.value, { stream: true });
  }
  return html;
}

/**
 * The server renderer writes provider values onto the same context objects the client reads,
 * and leaves its last task's values there when its work loop yields: a real server has no
 * client renderer in its realm. A trivial render's work loop switches back to the root
 * context, which restores every provider's default before the client renders again.
 */
async function restoreContextDefaults(): Promise<void> {
  const stream = await renderToReadableStream(null);
  await stream.allReady;
  await readUntil(stream.getReader(), () => false);
}

/**
 * Server-renders `page(boundary)` with React's streaming renderer, where `boundary` is a
 * Suspense boundary whose `content` waits until `finishStreaming`. Only the shell is placed
 * in the document before `hydrateRoot` runs on the same tree, so the boundary is still
 * dehydrated and pending, as in a host whose stream is slower than hydration.
 *
 * @param page - Wraps the boundary in the tree under test.
 * @param content - What the boundary shows once the server finishes it.
 * @returns The hydrated page.
 */
export async function hydrateStreamedPage(
  page: (boundary: ReactNode) => ReactNode,
  content: ReactNode
): Promise<StreamedPage> {
  let finish: () => void = () => undefined;
  const serverWork = new Promise<void>((resolve) => {
    finish = resolve;
  });
  function AfterServerWork({ children }: { children: ReactNode }): ReactNode {
    use(serverWork);
    return children;
  }
  // A boundary with no host element above it holds back the whole shell, so it gets a <main>.
  // The shell is complete once the end marker after the page has streamed.
  const tree = (
    <>
      {page(
        <main>
          <Suspense fallback={<p>{STREAMED_FALLBACK_TEXT}</p>}>
            <AfterServerWork>{content}</AfterServerWork>
          </Suspense>
        </main>
      )}
      <hr data-shell-end="" />
    </>
  );

  // Everything the helper changes is undone after the test, even when setup below throws.
  const previousReadyState = Object.getOwnPropertyDescriptor(document, "readyState");
  const host = document.createElement("div");
  // Streamed scripts and segments land beside the root, as they would in <body>, and run.
  const tail = document.createElement("div");
  let closing = false;
  let reader: ReadableStreamDefaultReader<unknown> | undefined;
  let root: Root | undefined;
  cleanups.push(() => {
    closing = true;
    if (previousReadyState === undefined) {
      // Deleting the own property uncovers Document.prototype's real getter again.
      Reflect.deleteProperty(document, "readyState");
    } else {
      Object.defineProperty(document, "readyState", previousReadyState);
    }
    root?.unmount();
    host.remove();
    tail.remove();
    void reader?.cancel();
  });

  // React client-renders a pending boundary at once in a document that finished loading,
  // since no more of the stream can arrive; a streaming page is still loading.
  Object.defineProperty(document, "readyState", { configurable: true, get: () => "loading" });
  const stream = (
    await renderToReadableStream(tree, {
      onError: (error) => {
        if (!closing) {
          console.error(error);
        }
      },
    })
  ).getReader();
  reader = stream;
  host.innerHTML = await readUntil(stream, (html) => /<hr data-shell-end=""\/?>/.test(html));
  await restoreContextDefaults();
  // A contextual fragment's scripts run once inserted, unlike innerHTML's.
  for (const script of host.querySelectorAll(":scope > script")) {
    script.remove();
    tail.append(document.createRange().createContextualFragment(script.outerHTML));
  }
  document.body.append(host, tail);

  const recoverableErrors: unknown[] = [];
  root = hydrateRoot(host, tree, {
    onRecoverableError: (error) => {
      recoverableErrors.push(error);
    },
  });

  return {
    host,
    recoverableErrors,
    finishStreaming: async () => {
      finish();
      const rest = await readUntil(stream, () => false);
      await restoreContextDefaults();
      tail.append(document.createRange().createContextualFragment(rest));
    },
  };
}

/** The server's pending boundary markers: its `<template id="B:…">` and fallback paragraph. */
export function serverBoundaryNodes(host: HTMLElement) {
  return {
    template: host.querySelector('template[id^="B:"]'),
    fallback: [...host.querySelectorAll("p")].find((p) => p.textContent === STREAMED_FALLBACK_TEXT) ?? null,
  };
}

/**
 * Waits long enough for React to have run any retry it scheduled after the last commit, so a
 * test can assert that a dehydrated boundary was left alone rather than not yet touched.
 */
export async function settleScheduledWork(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

/**
 * The values in commit order without consecutive repeats, so an extra commit of an unchanged
 * value does not count as a step.
 *
 * @param values - What each commit recorded.
 * @returns The distinct steps.
 */
export function distinctSteps<T>(values: readonly T[]): T[] {
  return values.filter((value, index) => index === 0 || value !== values[index - 1]);
}
