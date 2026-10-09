/**
 * The canvas's pointer gesture as one explicit state, stepped by a pure reducer. Points are in
 * canvas coordinates.
 */

import type { Point } from "./viewport";

/** One finger of a pinch and where it was at the last step. */
export type Contact = { readonly id: number; readonly point: Point };

export type Gesture =
  | { readonly kind: "idle" }
  /**
   * A finger down that has stayed within `TAP_SLOP` of where it landed. Lifting it is a tap;
   * moving past the slop turns it into a pan, and a second finger into a pinch.
   */
  | { readonly kind: "press"; readonly pointerId: number; readonly origin: Point; readonly point: Point }
  /** One pointer pans: a finger, a middle-mouse drag or the Hand tool. Only a finger can become a pinch. */
  | { readonly kind: "pan"; readonly pointerId: number; readonly anchor: Point; readonly touch: boolean }
  /** A drag while Space holds the hand. Releasing Space ends it. */
  | { readonly kind: "space-pan"; readonly pointerId: number; readonly anchor: Point }
  /** Two fingers, with their distance and midpoint at the last step. */
  | {
      readonly kind: "pinch";
      readonly first: Contact;
      readonly second: Contact;
      readonly distance: number;
      readonly mid: Point;
    };

export type GestureInput =
  /**
   * A press the canvas owns. From idle, a finger starts a press and any other pointer a pan; the
   * caller decides which may.
   */
  | {
      readonly type: "down";
      readonly pointerId: number;
      readonly point: Point;
      readonly touch: boolean;
      readonly space: boolean;
    }
  | { readonly type: "move"; readonly pointerId: number; readonly point: Point }
  | { readonly type: "up"; readonly pointerId: number }
  /** `pointercancel` or `lostpointercapture`: the browser took the pointer away. */
  | { readonly type: "cancel"; readonly pointerId: number }
  | { readonly type: "space-up" };

/** A camera move: zoom by `factor` about `anchor` first, when given, then pan by `delta`. */
export type CameraMove = {
  readonly delta: Point;
  readonly zoom?: { readonly anchor: Point; readonly factor: number };
};

/** The gesture after a step, its camera move, and `tap` when a finger lifted from a press. */
export type GestureStep = { readonly gesture: Gesture; readonly move?: CameraMove; readonly tap?: true };

export const IDLE: Gesture = { kind: "idle" };

/** How far, in px, a finger may move from where it landed and still tap. */
export const TAP_SLOP = 6;

function pinchOf(first: Contact, second: Contact): Extract<Gesture, { kind: "pinch" }> {
  return {
    kind: "pinch",
    first,
    second,
    distance: Math.hypot(first.point.x - second.point.x, first.point.y - second.point.y),
    mid: { x: (first.point.x + second.point.x) / 2, y: (first.point.y + second.point.y) / 2 },
  };
}

function owns(gesture: Gesture, pointerId: number): boolean {
  switch (gesture.kind) {
    case "idle":
      return false;
    case "press":
    case "pan":
    case "space-pan":
      return gesture.pointerId === pointerId;
    case "pinch":
      return gesture.first.id === pointerId || gesture.second.id === pointerId;
  }
}

/**
 * The gesture after `event`, and the camera move it makes. A finger that leaves a press pans the
 * whole way from where it landed, so the slop costs no distance. A finger lifted from a pinch
 * hands over to a pan anchored on the finger that stays, so it keeps panning without a fresh
 * press, and that pan's lift is no tap.
 */
export function stepGesture(gesture: Gesture, event: GestureInput): GestureStep {
  switch (event.type) {
    case "down": {
      if (gesture.kind === "idle") {
        return {
          gesture: event.space
            ? { kind: "space-pan", pointerId: event.pointerId, anchor: event.point }
            : event.touch
              ? { kind: "press", pointerId: event.pointerId, origin: event.point, point: event.point }
              : { kind: "pan", pointerId: event.pointerId, anchor: event.point, touch: false },
        };
      }
      if (gesture.kind === "press" && event.touch && event.pointerId !== gesture.pointerId) {
        return {
          gesture: pinchOf(
            { id: gesture.pointerId, point: gesture.point },
            { id: event.pointerId, point: event.point }
          ),
        };
      }
      if (gesture.kind === "pan" && gesture.touch && event.touch && event.pointerId !== gesture.pointerId) {
        return {
          gesture: pinchOf(
            { id: gesture.pointerId, point: gesture.anchor },
            { id: event.pointerId, point: event.point }
          ),
        };
      }
      return { gesture };
    }
    case "move": {
      if (!owns(gesture, event.pointerId)) {
        return { gesture };
      }
      if (gesture.kind === "pinch") {
        const contact = { id: event.pointerId, point: event.point };
        const next = pinchOf(
          gesture.first.id === event.pointerId ? contact : gesture.first,
          gesture.second.id === event.pointerId ? contact : gesture.second
        );
        return {
          gesture: next,
          move: {
            delta: { x: next.mid.x - gesture.mid.x, y: next.mid.y - gesture.mid.y },
            zoom: { anchor: gesture.mid, factor: next.distance / Math.max(gesture.distance, 1) },
          },
        };
      }
      if (gesture.kind === "idle") {
        return { gesture };
      }
      if (gesture.kind === "press") {
        const delta = { x: event.point.x - gesture.origin.x, y: event.point.y - gesture.origin.y };
        if (Math.hypot(delta.x, delta.y) <= TAP_SLOP) {
          return { gesture: { ...gesture, point: event.point } };
        }
        return {
          gesture: { kind: "pan", pointerId: gesture.pointerId, anchor: event.point, touch: true },
          move: { delta },
        };
      }
      return {
        gesture: { ...gesture, anchor: event.point },
        move: { delta: { x: event.point.x - gesture.anchor.x, y: event.point.y - gesture.anchor.y } },
      };
    }
    case "up": {
      if (!owns(gesture, event.pointerId)) {
        return { gesture };
      }
      if (gesture.kind === "pinch") {
        const stays = gesture.first.id === event.pointerId ? gesture.second : gesture.first;
        return { gesture: { kind: "pan", pointerId: stays.id, anchor: stays.point, touch: true } };
      }
      return gesture.kind === "press" ? { gesture: IDLE, tap: true } : { gesture: IDLE };
    }
    case "cancel":
      return { gesture: owns(gesture, event.pointerId) ? IDLE : gesture };
    case "space-up":
      return { gesture: gesture.kind === "space-pan" ? IDLE : gesture };
  }
}
