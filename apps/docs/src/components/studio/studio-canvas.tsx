"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
  ReactNode,
} from "react";

import { tv } from "tailwind-variants";

import { IDLE, stepGesture } from "../../lib/studio/gesture";
import type { Gesture, GestureInput } from "../../lib/studio/gesture";
import { wheelZoomFactor } from "../../lib/studio/viewport";
import type { Point } from "../../lib/studio/viewport";
import { isTypingTarget } from "../../lib/typing-target";
import { ChromeScope } from "./chrome-scope";
import { CornerXrayOverlay } from "./corner-xray";
import { PartOutline, usePartSelection } from "./studio-part-selection";
import { CANVAS_ID, regionProps } from "./studio-regions";
import { OVERLAYS } from "./studio-shortcuts";
import { useStudio } from "./studio-state";
import { StudioToolbar } from "./studio-toolbar";
import { useViewportCommands, useViewportState } from "./studio-viewport";

const studioCanvas = tv({
  slots: {
    // The first fit frames the first artboard below `lg`, and every artboard from it. The focus
    // ring is drawn on a layer above the artboards and the toolbar, which would cover its own.
    canvas:
      "data-[gliding=true]:studio-glide relative isolate min-h-0 min-w-0 touch-none overflow-hidden overscroll-none outline-none select-none [--studio-first-fit:artboard] after:pointer-events-none after:absolute after:inset-0 after:z-40 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring data-[pan=true]:cursor-grab data-[panning=true]:cursor-grabbing lg:[--studio-first-fit:all]",
    backdrop: "studio-dot-grid absolute inset-0 bg-muted",
    world:
      "studio-world invisible data-[pan=true]:pointer-events-none data-[pan=true]:**:pointer-events-none data-[part=true]:**:cursor-crosshair data-[ready=true]:visible",
    status: "sr-only",
  },
});

const styles = studioCanvas();

/**
 * Elements a press inside an artboard belongs to, so the Select tool leaves them alone and they
 * keep working: form controls, links, widgets with a role, and anything focusable.
 */
const CONTROLS = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "label",
  "summary",
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="slider"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Whether `target` is, or sits inside, a control. */
function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROLS) !== null;
}

/**
 * Whether an event on `target` belongs to an open overlay inside an artboard, such as a menu or
 * a dialog, rather than to the canvas. Wheel, pointer and pinch handling all ask this.
 */
function inOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OVERLAYS) !== null;
}

/** WebKit's trackpad pinch, which Safari sends instead of a ctrl + wheel event. */
type GestureEvent = UIEvent & { readonly scale: number; readonly clientX: number; readonly clientY: number };

/**
 * The studio canvas: a muted, dot-gridded plane the page's artboards sit on, panned and zoomed
 * like Figma's. The camera is `--studio-zoom` and `--studio-pan-x/y` on this element, which the
 * world layer, the grid, the artboard labels and the selection outline all read.
 *
 * Direct manipulation never animates. A programmatic move sets `data-gliding`, which transitions
 * the registered camera properties; the central reduced-motion rule in Fuse leaves no
 * transition on them, so reduced motion jumps.
 */
export function StudioCanvas({ children }: { children: ReactNode }): ReactElement {
  const { tool, setTool, select, selectedId } = useStudio();
  const { part, pick, clear: clearPart, partMode, setPartMode } = usePartSelection();
  const commands = useViewportCommands();
  const { attachCanvas } = commands;
  const { viewport, gliding, ready, announcement } = useViewportState();
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const gesture = useRef<Gesture>(IDLE);
  /** What a finger pressed with the Select tool, so a tap selects it; `null` with the hand. */
  const pressTarget = useRef<EventTarget | null>(null);

  const panMode = tool === "hand" || spaceHeld;

  /** A client point in canvas coordinates. */
  const local = (clientX: number, clientY: number): Point => {
    const rect = commands.canvas()?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  /**
   * Selects the artboard a Select press on `target` lands in, leaving its controls alone, or
   * clears the selection on empty canvas.
   */
  const selectAt = useCallback(
    (target: EventTarget | null) => {
      const artboard = target instanceof Element ? target.closest<HTMLElement>("[data-artboard-id]") : null;
      if (artboard === null) {
        select(undefined);
      } else if (!isControl(target)) {
        clearPart();
        select(artboard.dataset.artboardId);
      }
    },
    [select, clearPart]
  );

  /**
   * The element a primary press picks a part at, rather than using it: with the Select tool, and
   * Alt held or "Select part" on, inside an artboard. Overlays inside artboards count; the canvas
   * chrome, such as the toolbar, does not.
   */
  const pickTarget = (event: ReactMouseEvent<HTMLElement>): Element | undefined => {
    const { target } = event;
    const picking = tool === "select" && !spaceHeld && event.button === 0 && (event.altKey || partMode);
    return picking &&
      target instanceof Element &&
      target.closest("[data-canvas-overlay]") === null &&
      target.closest("[data-demo-stage]") !== null
      ? target
      : undefined;
  };

  // A picking press never reaches the part: capturing it here keeps a button from pressing, a
  // menu from opening and a field from taking focus. Like a press on an artboard's empty space,
  // it takes the keyboard off the artboard's controls, so Escape then clears the selection.
  const onPointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    const target = pickTarget(event);
    if (target !== undefined && pick(target)) {
      event.preventDefault();
      event.stopPropagation();
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest("[data-artboard-id]") !== null) {
        focused.blur();
      }
    }
  };
  const swallowPick = (event: ReactMouseEvent<HTMLElement>) => {
    if (pickTarget(event) !== undefined) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  // In "Select part" mode, Enter or Space on a focused artboard control picks it as a press
  // would, so the keyboard reaches every part the pointer does and a key never uses a control
  // that a press would only pick. Capturing it keeps the control and its menus from seeing it.
  const onKeyDownCapture = (event: ReactKeyboardEvent<HTMLElement>) => {
    const { target } = event;
    if (
      partMode &&
      tool === "select" &&
      (event.key === "Enter" || event.key === " ") &&
      !event.altKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      target instanceof Element &&
      target.closest("[data-canvas-overlay]") === null &&
      isControl(target) &&
      pick(target)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /** Steps the gesture, applies the camera move it makes and selects on a tap. */
  const dispatch = useCallback(
    (event: GestureInput) => {
      const step = stepGesture(gesture.current, event);
      gesture.current = step.gesture;
      setPanning(step.gesture.kind !== "idle" && step.gesture.kind !== "press");
      if (step.tap === true && pressTarget.current !== null) {
        selectAt(pressTarget.current);
      }
      if (step.move?.zoom !== undefined) {
        commands.zoomAround(step.move.zoom.anchor, step.move.zoom.factor);
      }
      if (step.move !== undefined) {
        commands.panBy(step.move.delta);
      }
    },
    [commands, selectAt]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target;
    if (
      inOverlay(target) ||
      (target instanceof Element && target.closest("[data-canvas-overlay]") !== null)
    ) {
      return;
    }
    const touch = event.pointerType === "touch";
    const idle = gesture.current.kind === "idle";
    // From idle, a press pans when the hand is out, on a middle button, or a finger off a
    // control, which taps instead when it lifts unmoved. A finger landing during a touch
    // gesture joins it as a pinch.
    const joins = idle ? event.button === 1 || panMode || (touch && !isControl(target)) : touch;
    if (joins) {
      if (idle) {
        pressTarget.current = panMode ? null : target;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dispatch({
        type: "down",
        pointerId: event.pointerId,
        point: local(event.clientX, event.clientY),
        touch,
        space: spaceHeld && tool !== "hand" && event.button !== 1,
      });
      return;
    }
    if (idle && event.button === 0) {
      selectAt(target);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current.kind !== "idle") {
      dispatch({ type: "move", pointerId: event.pointerId, point: local(event.clientX, event.clientY) });
    }
  };

  // Wheel and WebKit gesture events must be non-passive to keep the page from scrolling or
  // zooming, which React's synthetic wheel listener cannot be.
  useEffect(() => {
    const canvas = commands.canvas();
    if (canvas === null) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      const zoom = event.ctrlKey || event.metaKey;
      // An open list or menu inside an artboard scrolls itself.
      if (!zoom && inOverlay(event.target)) {
        return;
      }
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      const rect = canvas.getBoundingClientRect();
      if (zoom) {
        commands.zoomAround(
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          wheelZoomFactor(event.deltaY * unit)
        );
        return;
      }
      // A mouse sends shift + wheel as a vertical delta; it means sideways.
      const sideways = event.shiftKey && event.deltaX === 0;
      commands.panBy({
        x: -(sideways ? event.deltaY : event.deltaX) * unit,
        y: sideways ? 0 : -event.deltaY * unit,
      });
    };
    let gestureScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureScale = 1;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      // SAFETY: only WebKit dispatches `gesturechange`, and it dispatches it as a GestureEvent.
      const pinch = event as GestureEvent;
      const rect = canvas.getBoundingClientRect();
      commands.zoomAround(
        { x: pinch.clientX - rect.left, y: pinch.clientY - rect.top },
        pinch.scale / gestureScale
      );
      gestureScale = pinch.scale;
    };
    // Focus moving into or through an artboard, by Tab or a click, brings it into view.
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) {
        commands.revealFocus(event.target);
      }
    };
    // The camera alone moves the world. Focusing an element out of view makes the browser scroll
    // the canvas, which `overflow: hidden` still allows, so that scroll is undone.
    const onScroll = () => {
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("gesturestart", onGestureStart);
    canvas.addEventListener("gesturechange", onGestureChange);
    canvas.addEventListener("focusin", onFocusIn);
    canvas.addEventListener("scroll", onScroll);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("gesturestart", onGestureStart);
      canvas.removeEventListener("gesturechange", onGestureChange);
      canvas.removeEventListener("focusin", onFocusIn);
      canvas.removeEventListener("scroll", onScroll);
    };
  }, [commands]);

  // Figma's shortcuts. A key typed into a field or an open overlay belongs to it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape drops a picked part wherever focus is, such as on the toolbar's "Select part"
      // or in an artboard's field, unless an open popup took the key to close itself.
      if (
        event.key === "Escape" &&
        part !== undefined &&
        !event.defaultPrevented &&
        !inOverlay(event.target)
      ) {
        clearPart();
        select(undefined);
        return;
      }
      if (event.defaultPrevented || isTypingTarget(event.target, OVERLAYS)) {
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      const shortcut = { animate: true, announce: true } as const;
      if (event.shiftKey && !mod && !event.altKey && event.code === "Digit1") {
        event.preventDefault();
        commands.zoomToFit(shortcut);
      } else if (event.shiftKey && !mod && !event.altKey && event.code === "Digit2") {
        event.preventDefault();
        if (selectedId !== undefined) {
          commands.zoomToArtboard(selectedId, shortcut);
        }
      } else if (mod && !event.altKey && event.key === "0") {
        event.preventDefault();
        commands.zoomTo(1, shortcut);
      } else if (mod && !event.altKey && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        commands.zoomStep(1, shortcut);
      } else if (mod && !event.altKey && (event.key === "-" || event.key === "_")) {
        event.preventDefault();
        commands.zoomStep(-1, shortcut);
      } else if (mod || event.altKey) {
        return;
      } else if (event.key === " " && !isControl(event.target)) {
        // Space on a focused control presses it; elsewhere it holds the hand.
        event.preventDefault();
        setSpaceHeld(true);
      } else if (event.shiftKey) {
        return;
      } else if (event.key === "v" || event.key === "V") {
        setTool("select");
      } else if (event.key === "h" || event.key === "H") {
        setTool("hand");
      } else if (event.key === "p" || event.key === "P") {
        setPartMode(!partMode);
      } else if (event.key === "Escape" && !isControl(event.target)) {
        select(undefined);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setSpaceHeld(false);
        dispatch({ type: "space-up" });
      }
    };
    const release = () => {
      setSpaceHeld(false);
      dispatch({ type: "space-up" });
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, [commands, dispatch, select, selectedId, setTool, part, clearPart, partMode, setPartMode]);

  const camera: CSSProperties & Record<`--${string}`, string | number> = {
    "--studio-zoom": viewport.zoom,
    "--studio-pan-x": `${String(viewport.x)}px`,
    "--studio-pan-y": `${String(viewport.y)}px`,
  };

  return (
    <section
      ref={attachCanvas}
      id={CANVAS_ID}
      aria-label="Canvas"
      {...regionProps}
      className={styles.canvas()}
      style={camera}
      data-studio-canvas
      data-gliding={gliding}
      data-pan={panMode}
      data-panning={panning}
      onPointerDownCapture={onPointerDownCapture}
      onMouseDownCapture={swallowPick}
      onClickCapture={swallowPick}
      onKeyDownCapture={onKeyDownCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        dispatch({ type: "up", pointerId: event.pointerId });
      }}
      onPointerCancel={(event) => {
        dispatch({ type: "cancel", pointerId: event.pointerId });
      }}
      onLostPointerCapture={(event) => {
        dispatch({ type: "cancel", pointerId: event.pointerId });
      }}>
      <ChromeScope aria-hidden className={styles.backdrop()} />
      <div
        className={styles.world()}
        data-ready={ready}
        data-pan={panMode}
        data-part={partMode && !panMode}
        data-studio-world>
        {children}
      </div>
      <CornerXrayOverlay canvas={commands.canvas} />
      <PartOutline />
      <StudioToolbar />
      <p role="status" aria-live="polite" className={styles.status()}>
        {announcement}
      </p>
    </section>
  );
}
