/**
 * The plan of one run. The planning pass reads the file, checks it against the kit and
 * records each write as an operation with the change line Plan shows for it. The pass writes
 * nothing. Apply runs the same pass to the end, so a conflict or a missing variable stops the
 * run before the first write, and then performs the operations in the order the pass
 * recorded them.
 */

/** A write, or writes that must run together, and the line Plan shows for it. */
export type Operation = {
  /** The node the operation touches, such as `Button / variant=default, size=sm`. */
  readonly label: string;
  /** What changes, such as `paddingLeft → control-px-button-sm`. */
  readonly description: string;
  readonly perform: () => void | Promise<void>;
};

/** What a planning pass found: its operations, in the order Apply performs them, and its warnings. */
export type Plan = {
  readonly operations: Operation[];
  readonly warnings: string[];
};

/**
 * A node an operation writes to. Either the pass read it from the file, or an earlier
 * operation creates it.
 */
export type Target<Node> = {
  /** The node the pass read, or undefined when an earlier operation creates it. */
  readonly existing: Node | undefined;
  /** The node at the moment an operation runs. */
  readonly get: () => Node;
};

/** A planning pass that has run to the end, and what its planner returned. */
export type PlannedRun<Result> = {
  readonly plan: Plan;
  readonly result: Result;
};

/**
 * Start an empty plan.
 *
 * @param warnings - The list to add warnings to. A plan for a group of writes shares its
 *   parent's list.
 * @returns A plan with no operations.
 */
export function newPlan(warnings: string[] = []): Plan {
  return { operations: [], warnings };
}

/**
 * Record one operation.
 *
 * @param plan - The plan.
 * @param label - The node the change touches.
 * @param description - What changes.
 * @param perform - The write that makes the change. It runs only when Apply performs the plan.
 */
export function change(
  plan: Plan,
  label: string,
  description: string,
  perform: () => void | Promise<void>
): void {
  plan.operations.push({ label, description, perform });
}

/**
 * Record the writes a group plans as one operation, for writes where a later one depends on
 * an earlier one. The operation performs the group's writes in order and then `finish`, and
 * Plan lists the group's changes on one line. A group that plans no write records nothing.
 *
 * @param plan - The plan.
 * @param label - The node the group touches.
 * @param build - Plans the group's writes into the plan it receives.
 * @param finish - Runs after the group's writes, such as a write that undoes a side effect of
 *   an earlier one.
 */
export function changeTogether(
  plan: Plan,
  label: string,
  build: (group: Plan) => void,
  finish: () => void
): void {
  const group = newPlan(plan.warnings);
  build(group);
  if (group.operations.length === 0) {
    return;
  }
  const description = group.operations.map((operation) => operation.description).join(", ");
  change(plan, label, description, async () => {
    await performPlan(group);
    finish();
  });
}

/**
 * Record the operations a group plans, each preceded by `step` when it runs, such as the font
 * loads Figma needs before a text write.
 *
 * @param plan - The plan.
 * @param step - Runs before each of the group's operations.
 * @param build - Plans the group's writes into the plan it receives.
 */
export function precede(plan: Plan, step: () => Promise<void>, build: (group: Plan) => void): void {
  const group = newPlan(plan.warnings);
  build(group);
  for (const operation of group.operations) {
    change(plan, operation.label, operation.description, async () => {
      await step();
      await operation.perform();
    });
  }
}

/**
 * A node the pass read from the file.
 *
 * @param node - The node.
 * @returns A target that resolves to the node.
 */
export function existing<Node>(node: Node): Target<Node> {
  return { existing: node, get: () => node };
}

/**
 * Record the creation of a node as one operation. When it runs, the operation makes the node,
 * plans the node's fields and its contents against the spec, and performs that plan at once.
 * Plan therefore lists a new node once, however much the spec puts inside it.
 *
 * Planning a new node cannot meet a conflict, because the node holds only what `make` put in
 * it. The kit check resolves every variable the spec names before the first write.
 *
 * @param plan - The plan.
 * @param label - Where the node goes.
 * @param description - What gets created, such as `create the text layer Label`.
 * @param make - Creates the node and gives it its key.
 * @param configure - Plans the new node's fields into the plan it receives. A node that `make`
 *   finishes needs none.
 * @returns The node, for later operations to read once this one has run.
 */
export function create<Node>(
  plan: Plan,
  label: string,
  description: string,
  make: () => Node,
  configure?: (node: Node, inner: Plan) => void | Promise<void>
): Target<Node> {
  let made: Node | undefined;
  change(plan, label, description, async () => {
    const node = make();
    made = node;
    if (configure !== undefined) {
      const inner = newPlan(plan.warnings);
      await configure(node, inner);
      await performPlan(inner);
    }
  });
  return {
    existing: undefined,
    get: () => {
      if (made === undefined) {
        throw new Error(`${label}: an operation read the node that "${description}" makes before that ran.`);
      }
      return made;
    },
  };
}

/**
 * Whether owned children sit in spec order once the plan has run. A node an operation creates
 * lands after every child the parent holds now, in the order the operations create them, and
 * a deletion keeps the order of the rest.
 *
 * @param children - The parent's children as the pass read them.
 * @param owned - The owned children, in spec order.
 * @returns True when the owned children need no reorder.
 */
export function keepsOrder<Node>(children: readonly Node[], owned: readonly Target<Node>[]): boolean {
  let created = 0;
  const positions = owned.map((target) => {
    if (target.existing === undefined) {
      created += 1;
      return children.length + created;
    }
    return children.indexOf(target.existing);
  });
  return positions.every((position, index) => index === 0 || position > (positions[index - 1] ?? -1));
}

/**
 * Record something the plugin cannot represent, without changing the file.
 *
 * @param plan - The plan.
 * @param label - The node the warning concerns.
 * @param message - What the plugin left out and why.
 */
export function warn(plan: Plan, label: string, message: string): void {
  const line = `${label}: ${message}`;
  if (!plan.warnings.includes(line)) {
    plan.warnings.push(line);
  }
}

/**
 * The change lines Plan shows.
 *
 * @param plan - The plan.
 * @returns One `label: description` line per operation, in order.
 */
export function changeLines(plan: Plan): string[] {
  return plan.operations.map((operation) => `${operation.label}: ${operation.description}`);
}

/**
 * Perform a plan's operations one after another, in the order the pass recorded them.
 *
 * @param plan - The plan.
 */
export async function performPlan(plan: Plan): Promise<void> {
  for (const operation of plan.operations) {
    await operation.perform();
  }
}

/**
 * Plan a run, and perform the plan when the run applies. The planning pass runs to the end
 * before the first operation, so an error it throws stops the run with the file untouched.
 *
 * @param apply - Whether to perform the plan or only return it.
 * @param planner - Records the run's operations and warnings into the plan it receives.
 * @returns The plan and what the planner returned.
 */
export async function runPlan<Result>(
  apply: boolean,
  planner: (plan: Plan) => Promise<Result>
): Promise<PlannedRun<Result>> {
  const plan = newPlan();
  const result = await planner(plan);
  if (apply) {
    await performPlan(plan);
  }
  return { plan, result };
}
