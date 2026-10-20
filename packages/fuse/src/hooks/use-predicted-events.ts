"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { RefCallback } from "react";

type IntentRegistration = {
  getElement: () => HTMLElement | null;
  /**
   * Whether the element's inflated hit rect may reach the viewport. A pointer cannot reach a
   * registration far outside it, so the handler skips its layout read.
   */
  isNearViewport: () => boolean;
  predictionZoneSize: number;
  onIntent: () => void;
};

type PredictedEventsOptions = {
  predictionZoneSize: number;
  onIntent: (() => void) | undefined;
  enabled: boolean;
};

type PredictedEventsResult = {
  ref: RefCallback<HTMLElement>;
};

const registrations = new Set<IntentRegistration>();

function predictedHitsZone(point: PointerEvent, rect: DOMRect, predictionZoneSize: number): boolean {
  return (
    point.clientX >= rect.left - predictionZoneSize &&
    point.clientX <= rect.right + predictionZoneSize &&
    point.clientY >= rect.top - predictionZoneSize &&
    point.clientY <= rect.bottom + predictionZoneSize
  );
}

function onDocumentPointerMove(event: PointerEvent): void {
  let predicted: PointerEvent[];
  try {
    predicted = event.getPredictedEvents();
  } catch {
    return;
  }
  if (predicted.length === 0) {
    return;
  }

  for (const registration of [...registrations]) {
    const element = registration.getElement();
    if (element === null || !registration.isNearViewport()) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    if (predicted.some((point) => predictedHitsZone(point, rect, registration.predictionZoneSize))) {
      registration.onIntent();
    }
  }
}

function registerIntent(registration: IntentRegistration): void {
  registrations.add(registration);
  if (registrations.size === 1) {
    document.addEventListener("pointermove", onDocumentPointerMove);
  }
}

function unregisterIntent(registration: IntentRegistration): void {
  if (!registrations.delete(registration)) {
    return;
  }
  if (registrations.size === 0) {
    document.removeEventListener("pointermove", onDocumentPointerMove);
  }
}

/**
 * Shared intent registry: at most one document pointermove listener while any
 * enabled onIntent registration exists.
 */
export function usePredictedEvents({
  predictionZoneSize,
  onIntent,
  enabled,
}: PredictedEventsOptions): PredictedEventsResult {
  const elementRef = useRef<HTMLElement | null>(null);
  /** The live registration's viewport observer, which follows a newly attached element. */
  const viewportRef = useRef<IntersectionObserver | null>(null);
  /** Whether the element's inflated hit rect may reach the viewport, as the observer last said. */
  const nearRef = useRef(true);
  const firedRef = useRef(false);
  const onIntentRef = useRef(onIntent);
  useLayoutEffect(() => {
    onIntentRef.current = onIntent;
  });

  const setRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
    const viewport = viewportRef.current;
    if (viewport !== null) {
      viewport.disconnect();
      nearRef.current = true;
      if (element !== null) {
        viewport.observe(element);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || firedRef.current) {
      return undefined;
    }

    // Near until the observer reports otherwise, so a registration is never skipped unseen. The
    // observer reports any move across the inflated viewport edge, layout shifts included.
    nearRef.current = true;
    const viewport = new IntersectionObserver(
      (entries) => {
        const latest = entries.at(-1);
        if (latest !== undefined) {
          nearRef.current = latest.isIntersecting;
        }
      },
      { rootMargin: `${String(predictionZoneSize)}px` }
    );
    if (elementRef.current !== null) {
      viewport.observe(elementRef.current);
    }
    viewportRef.current = viewport;

    // One idempotent teardown for both ends of the registration: the one-shot intent firing and
    // the effect's cleanup. Each drops the pointer subscription and the viewport observer.
    const release = () => {
      unregisterIntent(registration);
      viewport.disconnect();
      if (viewportRef.current === viewport) {
        viewportRef.current = null;
      }
    };

    const registration: IntentRegistration = {
      getElement: () => elementRef.current,
      isNearViewport: () => nearRef.current,
      predictionZoneSize,
      onIntent: () => {
        if (firedRef.current) {
          return;
        }
        firedRef.current = true;
        release();
        onIntentRef.current?.();
      },
    };

    registerIntent(registration);
    return () => {
      // `release` disconnects too; naming the observer here keeps its owner in plain sight.
      viewport.disconnect();
      release();
    };
  }, [enabled, predictionZoneSize]);

  return { ref: setRef };
}
