import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  ViewTransition,
} from "react";
import type { ComponentType } from "react";

import type { LayoutName } from "../deck/vocabulary.ts";
import { LAYOUTS } from "./layouts.tsx";
import type { MdxComponents } from "./manifest.ts";
import { fromHash, moveForKey, moveTo, toHash } from "./position.ts";
import type { Position } from "./position.ts";
import { RevealedSteps, Step } from "./step.tsx";

/** The components every slide gets without an import. */
const MDX_COMPONENTS = { Step } satisfies MdxComponents;

/** A slide, loaded. */
export type LoadedSlide = {
  readonly id: string;
  readonly title: string | null;
  readonly layout: LayoutName;
  readonly steps: number;
  readonly Content: ComponentType<{ readonly components: MdxComponents }>;
};

/** The deck the runtime renders. */
export type LoadedDeck = {
  readonly title: string;
  readonly aspect: "16:9" | "4:3";
  readonly slides: readonly LoadedSlide[];
};

/** The logical canvas size per aspect, scaled to fit the window. */
const CANVAS = { "16:9": { width: 1920, height: 1080 }, "4:3": { width: 1440, height: 1080 } } as const;

/**
 * Where a position came from. A move through the deck adds a history entry; a position read from
 * the address, at load or on Back, Forward or an edited hash, only corrects that entry when the
 * deck clamps it, so Back never returns to an address that clamps forward again.
 */
type Source = "navigation" | "address";

/**
 * The deck. A slide change runs in a transition, so it animates as a view transition and React
 * queues and batches presses that arrive while one runs. A step change is a synchronous update, so
 * it never starts a view transition. The URL hash mirrors the position; the first position comes
 * from the hash before the first paint, and Back and Forward animate only when the slide changes.
 */
export function Deck({ deck }: { readonly deck: LoadedDeck }) {
  const [current, setCurrent] = useState<{ readonly position: Position; readonly source: Source }>(() => ({
    position: fromHash(location.hash, deck.slides),
    source: "address",
  }));
  const { position } = current;
  // The position the latest key press asked for, which a pending transition has not committed yet.
  const target = useRef(position);
  const committed = useRef(position);

  useLayoutEffect(() => {
    committed.current = position;
  }, [position]);

  useEffect(() => {
    const go = (next: Position, source: Source) => {
      target.current = next;
      if (next.slide === committed.current.slide) {
        setCurrent({ position: next, source });
      } else {
        startTransition(() => {
          setCurrent({ position: next, source });
        });
      }
    };
    const onKey = (event: KeyboardEvent) => {
      // A control in the slide that handled the key, such as a slider or a tab list, keeps it.
      if (event.defaultPrevented || ownsKey(event.target, event.key)) {
        return;
      }
      const move = moveForKey(event);
      if (move !== null) {
        event.preventDefault();
        go(moveTo(target.current, move, deck.slides), "navigation");
      }
    };
    const onPopState = () => {
      const next = fromHash(location.hash, deck.slides);
      if (next.slide === committed.current.slide) {
        go(next, "address");
        return;
      }
      // React commits a transition started during `popstate` eagerly, so the browser can restore
      // scroll, and an eager commit runs no view transition. Starting it from the next task keeps
      // the slide change animated.
      setTimeout(() => {
        go(next, "address");
      });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPopState);
    };
  }, [deck.slides]);

  useEffect(() => {
    const hash = toHash(current.position, deck.slides);
    if (hash === location.hash) {
      return;
    }
    if (current.source === "address") {
      history.replaceState(null, "", hash);
    } else {
      history.pushState(null, "", hash);
    }
  }, [current, deck.slides]);

  useEffect(() => {
    document.title = deck.title;
  }, [deck.title]);

  const slide = deck.slides[position.slide];
  const canvas = CANVAS[deck.aspect];
  const scale = useSyncExternalStore(subscribeToResize, () =>
    Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height)
  );
  if (slide === undefined) {
    return <p className="deck-empty">The deck has no slides.</p>;
  }
  const Layout = LAYOUTS[slide.layout];
  const { Content } = slide;

  return (
    <div className="deck-viewport">
      <div
        className="deck-canvas"
        data-aspect={deck.aspect}
        style={{ width: canvas.width, height: canvas.height, scale: String(scale) }}>
        <ViewTransition default="none" update="deck-slide">
          <section
            key={slide.id}
            className="deck-slide"
            data-layout={slide.layout}
            aria-roledescription="slide"
            aria-label={slide.title ?? `Slide ${String(position.slide + 1)}`}>
            <RevealedSteps value={position.step}>
              <Layout>
                <Content components={MDX_COMPONENTS} />
              </Layout>
            </RevealedSteps>
          </section>
        </ViewTransition>
      </div>
      <p className="deck-live" aria-live="polite" aria-atomic="true">
        {`Slide ${String(position.slide + 1)} of ${String(deck.slides.length)}`}
      </p>
    </div>
  );
}

function subscribeToResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
  };
}

/** Controls that use Enter and Space themselves. */
const ACTIVATABLE =
  "a[href], button, summary, [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='tab'], [role='menuitem'], [role='option']";

/**
 * Whether the focused element needs the key more than the deck: every key in a text field, and
 * Enter and Space on a control that a press activates.
 */
function ownsKey(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    return true;
  }
  return (key === "Enter" || key === " ") && target.closest(ACTIVATABLE) !== null;
}
