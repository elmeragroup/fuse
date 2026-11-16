"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Glides the popup from the last step's place to the next one. When the step changes while the popup
 * stays open, the popup is pinned where it is on screen with an inline `translate`, the moment Base
 * UI moves its positioner to the new anchor. A frame later the pin is released under `data-gliding`,
 * and the `translate` transition in `overlayGlidingPopupClass` eases the popup to its new place. The
 * pin measures the popup's on-screen box, a running glide included, so a fast second step retargets
 * from where the popup is instead of jumping. Scrolling between steps never eases, because only the
 * first move after a step change is pinned.
 *
 * @param popup - The popup element, or `null` before it mounts.
 * @param stepKey - The shown step's key, which changes with the step.
 * @param reducedMotion - Whether the user asks for reduced motion, which turns the glide off.
 */
export function useTourGlide(popup: HTMLElement | null, stepKey: string, reducedMotion: boolean): void {
  const seen = useRef<{ readonly popup: HTMLElement | null; readonly key: string }>({ popup: null, key: "" });

  useLayoutEffect(() => {
    const previous = seen.current;
    seen.current = { popup, key: stepKey };
    const positioner = popup?.parentElement ?? null;
    // A new popup element is an opening, not a step change, and an ending clears the key.
    if (
      popup === null ||
      positioner === null ||
      previous.popup !== popup ||
      previous.key === stepKey ||
      stepKey === "" ||
      reducedMotion
    ) {
      return;
    }
    const before = popup.getBoundingClientRect();
    let frame = 0;
    const release = (): void => {
      frame = 0;
      popup.setAttribute("data-gliding", "");
      popup.style.removeProperty("transition");
      popup.style.removeProperty("translate");
    };
    // Base UI may rewrite the positioner's style before it moves it, so a write that leaves the
    // popup in place keeps the watch going.
    // Both run in one microtask before the next paint, so the measuring never shows.
    const pin = (): void => {
      popup.style.setProperty("transition", "none");
      const pinned = popup.style.getPropertyValue("translate");
      popup.style.removeProperty("translate");
      const after = popup.getBoundingClientRect();
      const x = before.left - after.left;
      const y = before.top - after.top;
      if (Math.abs(x) + Math.abs(y) < 1) {
        if (pinned !== "") {
          popup.style.setProperty("translate", pinned);
        }
        popup.style.removeProperty("transition");
        return;
      }
      observer.disconnect();
      popup.removeAttribute("data-gliding");
      popup.style.setProperty("translate", `${x}px ${y}px`);
      frame = requestAnimationFrame(release);
    };
    const observer = new MutationObserver(pin);
    observer.observe(positioner, { attributes: true, attributeFilter: ["style"] });
    const settle = (event: TransitionEvent): void => {
      if (event.target === popup && event.propertyName === "translate") {
        popup.removeAttribute("data-gliding");
      }
    };
    popup.addEventListener("transitionend", settle);
    popup.addEventListener("transitioncancel", settle);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      popup.removeEventListener("transitionend", settle);
      popup.removeEventListener("transitioncancel", settle);
      if (frame !== 0) {
        release();
      }
    };
  }, [popup, stepKey, reducedMotion]);
}
