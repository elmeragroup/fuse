"use client";

/**
 * A number that rolls its digits (D8, S3). Each digit of the formatted text is a reel of 0 to 9,
 * which the stylesheet slides to the digit on the ticker spring, in tabular figures, and every
 * other character, a group or decimal separator, a sign or a unit, stays where it is. Text of
 * another shape, such as one more digit or another unit, swaps at once instead of rolling, because
 * its reels would not line up. A hover step that lands less than 150 ms after the last one swaps the
 * digits at once, so a fast scrub never spins reels through digits that mean nothing, while the
 * entrance's count-up, a data update and a deliberate hover roll (MOTION-REVIEW F7). The server
 * writes every reel at rest. Under reduced motion the reels move at once, so the text swaps.
 */
import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { CHART_SPRINGS } from "./layout/motion";
import { springEasing } from "./layout/spring";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** The ticker spring the reels slide on, sampled once. */
const TICKER = springEasing(CHART_SPRINGS.ticker);

/** How soon after the last hover step, in milliseconds, a step swaps the digits instead of rolling. */
const FAST_STEP_MS = 150;

/** The text's shape: every digit a slot, every other character itself, which decides whether it rolls. */
function digitMask(text: string): string {
  return text.replace(/[0-9]/gu, "#");
}

/**
 * Formatted text whose digits roll to each new value of the same shape.
 *
 * @param props - The text, and the active item it shows, null for none, whose change is a hover step.
 * @returns The rolling text.
 */
export function ChartDigitRoll({
  text,
  step = null,
}: {
  readonly text: string;
  readonly step?: number | null;
}): ReactElement {
  const { duration, easing } = TICKER;
  const digits = useRef<HTMLSpanElement>(null);
  const last = useRef<{ readonly step: number | null; readonly at: number }>({
    step,
    at: Number.NEGATIVE_INFINITY,
  });
  // A step's new digits are written in this commit, so data-snap must be on before the browser
  // styles them, and comes off a frame later, once they rest.
  useLayoutEffect(() => {
    const before = last.current;
    if (before.step === step) return undefined;
    const now = performance.now();
    last.current = { step, at: now };
    const node = digits.current;
    if (node === null || now - before.at >= FAST_STEP_MS) return undefined;
    writeAttribute(node, "data-snap", "");
    const frame = requestAnimationFrame(() => {
      writeAttribute(node, "data-snap", null);
    });
    return () => {
      cancelAnimationFrame(frame);
      writeAttribute(node, "data-snap", null);
    };
  }, [step]);
  return (
    <span
      ref={digits}
      key={digitMask(text)}
      data-part="digits"
      style={{ "--_spring-duration": `${String(duration)}ms`, "--_spring-easing": easing }}>
      {text.split("").map((character, index) => {
        const digit = /^[0-9]$/u.test(character) ? Number(character) : -1;
        if (digit === -1) return <span key={index}>{character}</span>;
        return (
          <span key={index} data-part="digit">
            <span data-part="reel" data-reel="" style={{ "--_digit": digit }}>
              {DIGITS.map((shown) => (
                <span key={shown}>{shown}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

Object.assign(ChartDigitRoll, { displayName: "Chart.DigitRoll" });
