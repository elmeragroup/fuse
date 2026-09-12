"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefCallback } from "react";

type IntentRegistration = {
  getElement: () => HTMLElement | null;
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
    if (element === null) {
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
  const firedRef = useRef(false);
  const onIntentRef = useRef(onIntent);
  // oxlint-disable-next-line react/refs -- latest-ref write; the ref is read only from the document pointermove listener, after commit
  onIntentRef.current = onIntent;

  const setRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  useEffect(() => {
    if (!enabled || firedRef.current) {
      return undefined;
    }

    const registration: IntentRegistration = {
      getElement: () => elementRef.current,
      predictionZoneSize,
      onIntent: () => {
        if (firedRef.current) {
          return;
        }
        firedRef.current = true;
        unregisterIntent(registration);
        onIntentRef.current?.();
      },
    };

    registerIntent(registration);
    return () => {
      unregisterIntent(registration);
    };
  }, [enabled, predictionZoneSize]);

  return { ref: setRef };
}
