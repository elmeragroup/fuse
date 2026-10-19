/**
 * The record of one run. Plan and Apply walk the same code: every write goes through
 * {@link change}, which records the change and makes it only when the run applies. A plan
 * is therefore the exact list of writes an apply would make.
 */

/** What a run found to change, and whether it makes the changes. */
export type Ledger = {
  readonly apply: boolean;
  /** A muted ledger makes its writes without listing them, for a node the run just created. */
  readonly muted: boolean;
  readonly changes: string[];
  readonly warnings: string[];
};

/**
 * Start the record of a run.
 *
 * @param apply - Whether the run writes to the file or only plans.
 * @returns An empty ledger.
 */
export function newLedger(apply: boolean): Ledger {
  return { apply, muted: false, changes: [], warnings: [] };
}

/**
 * The same ledger with its change list silenced. A node the run creates is listed once as
 * created, and the writes that configure it go through this ledger.
 *
 * @param ledger - The run's ledger.
 * @returns A ledger that shares the run's lists and lists no changes.
 */
export function muted(ledger: Ledger): Ledger {
  return { ...ledger, muted: true };
}

/**
 * Record one change and make it when the run applies.
 *
 * @param ledger - The run's ledger.
 * @param label - The node the change touches, such as `Button / variant=default, size=sm`.
 * @param description - What changes, such as `paddingLeft → control-px-button-sm`.
 * @param write - The write that makes the change.
 */
export function change(ledger: Ledger, label: string, description: string, write: () => void): void {
  if (!ledger.muted) {
    ledger.changes.push(`${label}: ${description}`);
  }
  if (ledger.apply) {
    write();
  }
}

/**
 * Record the creation of a node and create it when the run applies.
 *
 * @param ledger - The run's ledger.
 * @param label - Where the node goes.
 * @param description - What gets created, such as `create the text layer label`.
 * @param make - Creates the node.
 * @returns The new node, or undefined when the run only plans.
 */
export function create<Made>(
  ledger: Ledger,
  label: string,
  description: string,
  make: () => Made
): Made | undefined {
  if (!ledger.muted) {
    ledger.changes.push(`${label}: ${description}`);
  }
  return ledger.apply ? make() : undefined;
}

/**
 * Record something the plugin cannot represent, without changing the file.
 *
 * @param ledger - The run's ledger.
 * @param label - The node the warning concerns.
 * @param message - What the plugin left out and why.
 */
export function warn(ledger: Ledger, label: string, message: string): void {
  const line = `${label}: ${message}`;
  if (!ledger.warnings.includes(line)) {
    ledger.warnings.push(line);
  }
}
