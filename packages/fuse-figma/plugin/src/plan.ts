/**
 * The plan of one run. The planning pass reads the file, checks it against the kit and
 * records each write as an operation with the change line Plan shows for it. It also records
 * what the operations need before the first of them runs, such as fonts. The pass writes
 * nothing. Apply runs the same pass to the end and meets every requirement, so a conflict, a
 * missing variable or a font Figma cannot load stops the run before the first write. Then it
 * performs the operations in the order the pass recorded them.
 */

/** A write, or writes that must run together, and the line Plan shows for it. */
export type Operation = {
  /** The node the operation touches, such as `Button / variant=default, size=sm`. */
  readonly label: string;
  /** What changes, such as `paddingLeft → control-px-button-sm`. */
  readonly description: string;
  readonly perform: () => void | Promise<void>;
};

/**
 * What a run needs before its first write, such as fonts, by key so each is met once. Every
 * plan in a run shares one registry, including the plans that new nodes make when their
 * operations run.
 */
export type Requirements = {
  readonly byKey: Map<string, () => Promise<void>>;
  /** True once the run has met them. A requirement after that is one the pass missed. */
  met: boolean;
};

/** What a planning pass found: its operations, in the order Apply performs them, and its warnings. */
export type Plan = {
  readonly operations: Operation[];
  readonly warnings: string[];
  readonly requirements: Requirements;
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
 * @param parent - The plan this one belongs to, such as the run's plan for a new node's
 *   contents. The new plan shares its warnings and requirements. Without one, the plan starts
 *   a run.
 * @returns A plan with no operations.
 */
export function newPlan(parent?: Plan): Plan {
  if (parent !== undefined) {
    return { operations: [], warnings: parent.warnings, requirements: parent.requirements };
  }
  return { operations: [], warnings: [], requirements: { byKey: new Map(), met: false } };
}

/**
 * Record something the run needs before its first write, such as a font that a text write
 * needs. A second requirement with the same key adds nothing.
 *
 * @param plan - The plan.
 * @param key - What the requirement is, such as `font Roboto Medium`.
 * @param meet - Meets the requirement, or throws when the run cannot.
 * @throws When the run has met its requirements already and has not met this one, because a
 *   write may have run before it.
 */
export function requirement(plan: Plan, key: string, meet: () => Promise<void>): void {
  const { requirements } = plan;
  if (requirements.byKey.has(key)) {
    return;
  }
  if (requirements.met) {
    throw new Error(`The run needs ${key}, which its planning pass did not prepare before the first write.`);
  }
  requirements.byKey.set(key, meet);
}

/**
 * Meet a run's requirements, one after another.
 *
 * @param plan - Any plan of the run.
 */
export async function meetRequirements(plan: Plan): Promise<void> {
  for (const meet of plan.requirements.byKey.values()) {
    await meet();
  }
  plan.requirements.met = true;
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
  const group = newPlan(plan);
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
 * it. The kit check resolves every variable the spec names before the first write, and the
 * outer pass requires the fonts the new node's text needs, so the contents' plan finds every
 * requirement met.
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
      const inner = newPlan(plan);
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
 * Plan a run, meet its requirements, and perform the plan when the run applies. The planning
 * pass and the requirements finish before the first operation, so an error in either stops
 * the run with the file untouched. A run that only plans meets the requirements too, so it
 * fails where an apply would.
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
  await meetRequirements(plan);
  if (apply) {
    await performPlan(plan);
  }
  return { plan, result };
}
