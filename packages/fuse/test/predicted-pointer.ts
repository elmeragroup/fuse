/**
 * Shared harness for the predicted-pointer API `usePredictedEvents` reads.
 * `getPredictedEvents` is a browser API no automation driver produces, so suites fake it;
 * one definition keeps "a predicted pointer" meaning the same thing in every suite.
 */

/**
 * Dispatches a `pointermove` whose `getPredictedEvents()` reports one predicted point at
 * (`clientX`, `clientY`). The dispatched event's own coordinates stay at the origin, so a
 * suite only passes by reading the prediction rather than the real pointer.
 */
export function dispatchPredictedPointer(clientX: number, clientY: number): void {
  const event = new PointerEvent("pointermove", { bubbles: true, clientX: 0, clientY: 0 });
  Object.defineProperty(event, "getPredictedEvents", {
    value: () => [new PointerEvent("pointermove", { clientX, clientY })],
  });
  document.dispatchEvent(event);
}
