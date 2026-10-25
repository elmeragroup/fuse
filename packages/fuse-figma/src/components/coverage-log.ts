/**
 * The coverage the cascade keeps beside the computed styles: who owns a declaration's rows, the logs
 * of the classes whose outcome only shows once every cell has cascaded, and where a row goes.
 *
 * - Each owner keeps logs of its own: a set for the classes of its boxes, and an instance part for the
 *   classes the outer component passes it and for the inner component's own. A class two owners
 *   share stays two entries, one in each owner's logs.
 * - A class that styles a child part or every element below its box hands its rule the entry that
 *   logs it, so the element that takes the rule marks that entry, whatever owner's scope it sits in.
 * - A row goes to the origin that owns its declaration, unless an instance part built in place holds
 *   the layer that reads it and the inner component does not own it, which leaves the row for the
 *   instance's diff to settle.
 */
import type { InPlace, Recorder } from "./cascade";
import type { CoverageRow } from "./coverage";
import type { PartTarget } from "./state-table";

/**
 * Who owns the coverage rows of a declaration: the set whose box holds its class, or, for an instance
 * part built in place, the inner component or the outer component that passes it the class. A row
 * goes to its owner's recorder, except where `InPlace` takes a composite's row first.
 */
export type Origin = { readonly record: Recorder };

/** A declaration of a logged class, as its rows name it. */
type LoggedDeclaration = { readonly property: string; readonly value: string };

/** A class of one box in an owner's logs, by the part that holds it. */
type LoggedClass = {
  readonly part: string;
  readonly className: string;
  readonly declarations: readonly LoggedDeclaration[];
};

/**
 * The entry of a class that styles a child part or every element below its box, which the rule the
 * class makes carries, so the element that takes the rule marks this entry and no other.
 */
export class LoggedRule {
  #taken = false;

  /** Note that an element took the rule in some cell. */
  take(): void {
    this.#taken = true;
  }

  /** Whether an element took the rule in some cell so far. */
  get taken(): boolean {
    return this.#taken;
  }
}

/** A logged class with condition variants, and whether they held together in some cell so far. */
type ConditionEntry = LoggedClass & { readonly variants: readonly string[]; held: boolean };

/** A logged class that styles child parts, with the parts it names, and its rule's entry. */
type PartRuleEntry = LoggedClass & { readonly target: PartTarget; readonly rule: LoggedRule };

/** A logged class that styles every element below its box, and its rule's entry. */
type DescendantRuleEntry = LoggedClass & { readonly rule: LoggedRule };

/** The key of a class in one owner's logs: the part that holds it and the class. */
function keyOf({ part, className }: Pick<LoggedClass, "part" | "className">): string {
  return JSON.stringify([part, className]);
}

/**
 * What the classes one owner gives its boxes did across the cells: the classes with condition
 * variants, the classes that style child parts, and the classes for every element below a box.
 * {@link finish} records what they leave once every cell has cascaded.
 */
export class CascadeLogs {
  readonly #conditions = new Map<string, ConditionEntry>();
  readonly #partRules = new Map<string, PartRuleEntry>();
  readonly #descendantRules = new Map<string, DescendantRuleEntry>();

  /**
   * Log a class with condition variants in a cell, keeping whether they held together in an
   * earlier cell.
   *
   * @param logged - The class, its declarations and its condition variants.
   * @param holds - Whether the variants hold together in this cell.
   */
  condition(logged: LoggedClass & { readonly variants: readonly string[] }, holds: boolean): void {
    const key = keyOf(logged);
    const entry = this.#conditions.get(key);
    if (entry === undefined) {
      this.#conditions.set(key, { ...logged, held: holds });
    } else if (holds) {
      entry.held = true;
    }
  }

  /**
   * Log a class that styles child parts in a cell.
   *
   * @param logged - The class, its declarations and the parts it names.
   * @returns The entry its rule carries, the same in every cell.
   */
  partRule(logged: LoggedClass & { readonly target: PartTarget }): LoggedRule {
    const key = keyOf(logged);
    const entry = this.#partRules.get(key) ?? { ...logged, rule: new LoggedRule() };
    this.#partRules.set(key, entry);
    return entry.rule;
  }

  /**
   * Log a class that styles every element below its box in a cell.
   *
   * @param logged - The class and its declarations.
   * @returns The entry its rule carries, the same in every cell.
   */
  descendantRule(logged: LoggedClass): LoggedRule {
    const key = keyOf(logged);
    const entry = this.#descendantRules.get(key) ?? { ...logged, rule: new LoggedRule() };
    this.#descendantRules.set(key, entry);
    return entry.rule;
  }

  /**
   * Record the classes whose variants never held in one cell together, such as
   * `aria-invalid:focus-visible:` on a set that draws invalid and focus as two values of its state
   * axis, or whose one variant never held in a cell that gives the class, as Calendar's day cell
   * gives `hover:bg-transparent` only while disabled, and as unmapped the classes that style a child
   * part no part of the definition took, since they style nothing the set draws, and as dropped the
   * classes for every element below a box that holds no element in any cell. Call it after every
   * cell.
   *
   * @param record - Where the owner's rows go once every cell has cascaded.
   */
  finish(record: Recorder): void {
    const rows = (logged: LoggedClass, note: Pick<CoverageRow, "outcome" | "detail">) => {
      for (const { property, value } of logged.declarations) {
        record({ part: logged.part, className: logged.className, property, value, ...note });
      }
    };
    for (const entry of this.#descendantRules.values()) {
      if (!entry.rule.taken) {
        rows(entry, {
          outcome: "dropped",
          detail: "no element sits below the box in any cell, so the class styles nothing the set draws",
        });
      }
    }
    for (const entry of this.#partRules.values()) {
      if (!entry.rule.taken) {
        rows(entry, { outcome: "unmapped", detail: untakenDetail(entry.target, entry.part) });
      }
    }
    for (const entry of this.#conditions.values()) {
      if (entry.held) {
        continue;
      }
      const named = entry.variants.map((variant) => `\`${variant}\``);
      rows(entry, {
        outcome: "dropped",
        detail:
          named.length === 1
            ? `no cell that gives the box this class shows ${named.join("")}`
            : `no cell of the matrix shows ${named.join(" and ")} at once`,
      });
    }
  }
}

/** Why a class that styles a child the definition never draws reaches nothing the set draws. */
function untakenDetail(target: PartTarget, part: string): string {
  switch (target.kind) {
    case "slot":
      return `the definition draws no part with \`data-slot=${target.slot}\` below ${part}`;
    case "tag":
      return `the definition draws no \`<${target.tag}>\` part below ${part}`;
    case "child-tag":
      return `the definition draws no direct \`<${target.tag}>\` child of ${part}`;
    case "every-child":
      return `the definition draws no part directly below ${part}`;
    case "label":
      return `the definition holds no label in a \`<${target.tag}>\` that is the last child of ${part}`;
  }
}

/**
 * Where a row goes: to the origin that owns its declaration, unless an instance part built in place
 * holds the layer and its inner component does not own the declaration, which leaves a composite's
 * row for the instance's diff to settle.
 *
 * @param inPlace - The instance part built in place that holds the layer that reads the declaration,
 *   undefined for a layer of the set's own boxes.
 * @param origin - The declaration's owner.
 * @returns The recorder of the row.
 */
export function routed(inPlace: InPlace | undefined, origin: Origin): Recorder {
  return inPlace === undefined || origin === inPlace.inner
    ? origin.record
    : (row) => {
        inPlace.composite(row, origin);
      };
}
