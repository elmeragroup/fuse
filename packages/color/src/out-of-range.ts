/**
 * The failure a smart constructor returns for a number outside the range its value allows.
 */

/** A number outside the range a color component or a mix weight allows. */
export class OutOfRange extends Error {
  /** The tag Effect's `catchTag` and a `switch` match on. */
  readonly _tag = "OutOfRange" as const;

  /** What the number was for, such as `Oklch c`. */
  readonly quantity: string;

  /** The rejected number. */
  readonly value: number;

  /**
   * Build the error for a number a smart constructor rejects.
   *
   * @param quantity - What the number was for, such as `Oklch c`.
   * @param value - The rejected number.
   * @param allowed - The numbers the quantity allows, as the message shows them, such as
   *   `a finite number in 0..1`.
   */
  constructor(quantity: string, value: number, allowed: string) {
    super(`${quantity} must be ${allowed}, received ${value}`);
    this.name = "OutOfRange";
    this.quantity = quantity;
    this.value = value;
  }
}
