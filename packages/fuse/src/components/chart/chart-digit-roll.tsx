"use client";

/**
 * A number that rolls its digits (D8, S3). Each digit of the formatted text is a reel of 0 to 9,
 * which the stylesheet slides to the digit on the ticker spring, in tabular figures, and every
 * other character, a group or decimal separator, a sign or a unit, stays where it is. Text of
 * another shape, such as one more digit or another unit, swaps at once instead of rolling, because
 * its reels would not line up. The server writes every reel at rest. Under reduced motion the
 * reels move at once, so the text swaps.
 */
import type { ReactElement } from "react";

import { CHART_SPRINGS } from "./layout/motion";
import { springEasing } from "./layout/spring";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** The ticker spring the reels slide on, sampled once. */
const TICKER = springEasing(CHART_SPRINGS.ticker);

/** The text's shape: every digit a slot, every other character itself, which decides whether it rolls. */
function digitMask(text: string): string {
  return text.replace(/[0-9]/gu, "#");
}

/**
 * Formatted text whose digits roll to each new value of the same shape.
 *
 * @param props - The text.
 * @returns The rolling text.
 */
export function ChartDigitRoll({ text }: { readonly text: string }): ReactElement {
  const { duration, easing } = TICKER;
  return (
    <span
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
