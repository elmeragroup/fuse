/**
 * The plan of one run. The planning pass reads the file, checks it against the kit and
 * records each write as an operation with the change line Plan shows for it. It also records
 * what the operations need before the first of them runs, such as fonts. The pass writes
 * nothing. Apply runs the same pass to the end and meets every requirement, so a conflict, a
 * missing variable or a font Figma cannot load stops the run before the first write. Then it
 * performs the operations in the order the pass recorded them.
 *
 * The pass runs as an Effect. The `Plan` service holds the recorder the structural walk records
 * into, and the walk hands the leaf planners that recorder in their `Run`. The leaf planners stay
 * synchronous and record each operation with a plain write, which `change` wraps in an Effect. An
 * operation that plans a new node's contents when it runs, as `create` and `planWhenRun` record,
 * captures the services it reads when the pass records it, and provides its own recorder.
 */

import { Context, Effect } from "effect";

import type { PluginError } from "./errors.ts";

/** A write, or writes that must run together, and the line Plan shows for it. */
export type Operation = {
  /** The node the operation touches, such as `Button / variant=default, size=sm`. */
  readonly label: string;
  /** What changes, such as `paddingLeft → control-px-button-sm`. */
  readonly description: string;
  /** The write, which reads no service: one it needs was captured when the pass recorded it. */
  readonly perform: Effect.Effect<void, PluginError>;
};

/**
 * What a run needs before its first write, such as fonts, by key so each is met once. Every
 * plan in a run shares one registry, including the plans that new nodes make when their
 * operations run.
 */
export type Requirements = {
  readonly byKey: Map<string, Effect.Effect<void, PluginError>>;
  /** True once the run has met them. A requirement after that is one the pass missed. */
  met: boolean;
};

/**
 * What a planning pass found: its operations, in the order Apply performs them, and its warnings.
 * The recorder only grows, and one fiber writes it, so order is the order of recording.
 */
export type PlanRecorder = {
  readonly operations: Operation[];
  readonly warnings: string[];
  readonly requirements: Requirements;
};

/** The recorder the structural walk records into: the run's own, or a group's or a new node's. */
export class Plan extends Context.Service<Plan, PlanRecorder>()("@elmeragroup/fuse-figma/plugin/Plan") {
  /**
   * Run an effect and report whether it recorded an operation into the current recorder. An
   * operation the effect records into a recorder of its own, such as a new node's, does not count.
   *
   * @param effect - The planning to watch.
   * @returns What the effect returned, and whether it recorded an operation.
   */
  static readonly watch = Effect.fnUntraced(function* <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.fn.Return<readonly [A, boolean], E, R | Plan> {
    const plan = yield* Plan;
    const start = plan.operations.length;
    const result = yield* effect;
    return [result, plan.operations.length > start] as const;
  });
}

/**
 * Run a leaf planner and report whether it recorded an operation, as {@link Plan.watch} does for
 * an effect. The leaf planners stay synchronous, so they watch each other through this.
 *
 * @param plan - The recorder the planner records into.
 * @param planner - The planning to watch.
 * @returns Whether the planner recorded an operation.
 */
export function recordsAny(plan: PlanRecorder, planner: () => void): boolean {
  const start = plan.operations.length;
  planner();
  return plan.operations.length > start;
}

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
  readonly plan: PlanRecorder;
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
export function newPlan(parent?: PlanRecorder): PlanRecorder {
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
 * @param meet - Meets the requirement, or fails when the run cannot.
 * @throws A defect when the run has met its requirements already and has not met this one,
 *   because a write may have run before it.
 */
export function requirement(plan: PlanRecorder, key: string, meet: Effect.Effect<void, PluginError>): void {
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
 * @returns The Effect that meets them.
 */
const meetRequirements = Effect.fnUntraced(function* (plan: PlanRecorder) {
  for (const meet of plan.requirements.byKey.values()) {
    yield* meet;
  }
  plan.requirements.met = true;
});

/**
 * Record one operation.
 *
 * @param plan - The plan.
 * @param label - The node the change touches.
 * @param description - What changes.
 * @param perform - The write that makes the change. It runs only when Apply performs the plan.
 */
export function change(plan: PlanRecorder, label: string, description: string, perform: () => void): void {
  changeWith(plan, label, description, Effect.sync(perform));
}

/**
 * Record one operation whose write is an Effect, such as one that awaits Figma.
 *
 * @param plan - The plan.
 * @param label - The node the change touches.
 * @param description - What changes.
 * @param perform - The write. It runs only when Apply performs the plan.
 */
export function changeWith(
  plan: PlanRecorder,
  label: string,
  description: string,
  perform: Effect.Effect<void, PluginError>
): void {
  plan.operations.push({ label, description, perform });
}

/**
 * Record, into the current recorder, an operation whose write reads services, such as one that
 * plans more when it runs. The services are the ones in scope now, captured as the operation is
 * recorded, so the operation reads the run's file and its recorder's parent when Apply performs it.
 *
 * @param label - The node the change touches.
 * @param description - What changes.
 * @param perform - The write.
 * @returns The Effect that records the operation.
 */
export const changeLater = Effect.fnUntraced(function* <R>(
  label: string,
  description: string,
  perform: Effect.Effect<void, PluginError, R>
): Effect.fn.Return<void, never, R | Plan> {
  const context = yield* Effect.context<R>();
  const plan = yield* Plan;
  changeWith(plan, label, description, Effect.provideContext(perform, context));
});

/**
 * Record the writes a group plans as one operation, for writes where a later one depends on
 * an earlier one. The operation performs the group's writes in order and then `finish`, and
 * Plan lists the group's changes on one line. A group that plans no write records nothing.
 *
 * @param plan - The plan.
 * @param label - The node the group touches.
 * @param build - Plans the group's writes into the plan it receives.
 * @param finish - Runs after the group's writes, where the group needs it, such as a write that
 *   undoes a side effect of an earlier one.
 */
export function changeTogether(
  plan: PlanRecorder,
  label: string,
  build: (group: PlanRecorder) => void,
  finish?: () => void
): void {
  const group = newPlan(plan);
  build(group);
  if (group.operations.length === 0) {
    return;
  }
  const description = group.operations.map((operation) => operation.description).join(", ");
  const perform = performPlan(group);
  changeWith(
    plan,
    label,
    description,
    finish === undefined ? perform : Effect.andThen(perform, Effect.sync(finish))
  );
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
 * Plan, when the operation that calls this runs, what that operation then reads: the writes
 * `stage` records into a recorder of its own, performed at once, as `create` plans a new node's
 * contents.
 *
 * @param stage - Plans the writes. It reads the recorder the operation was recorded into as its
 *   parent.
 * @returns The Effect that plans and performs the writes.
 */
export const planWhenRun = Effect.fnUntraced(function* <E, R>(
  stage: Effect.Effect<unknown, E, R>
): Effect.fn.Return<void, E | PluginError, Exclude<R, Plan> | Plan> {
  const later = newPlan(yield* Plan);
  yield* Effect.provideService(stage, Plan, later);
  yield* performPlan(later);
});

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
 * @param label - Where the node goes.
 * @param description - What gets created, such as `create the text layer Label`.
 * @param make - Creates the node and gives it its key.
 * @param configure - Plans the new node's fields into the recorder it is given as `Plan`. A node
 *   that `make` finishes needs none.
 * @returns The node, for later operations to read once this one has run.
 */
export const create = Effect.fnUntraced(function* <Node, R = never>(
  label: string,
  description: string,
  make: () => Node,
  configure?: (node: Node) => Effect.Effect<unknown, PluginError, R>
): Effect.fn.Return<Target<Node>, never, Exclude<R, Plan> | Plan> {
  let made: Node | undefined;
  const perform = Effect.gen(function* () {
    const node = make();
    made = node;
    if (configure !== undefined) {
      yield* planWhenRun(configure(node));
    }
  });
  yield* changeLater(label, description, perform);
  const target: Target<Node> = {
    existing: undefined,
    get: () => {
      if (made === undefined) {
        throw new Error(`${label}: an operation read the node that "${description}" makes before that ran.`);
      }
      return made;
    },
  };
  return target;
});

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
  const indexOf = new Map(children.map((child, index) => [child, index]));
  let created = 0;
  const positions = owned.map((target) => {
    if (target.existing === undefined) {
      created += 1;
      return children.length + created;
    }
    return indexOf.get(target.existing) ?? -1;
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
export function warn(plan: PlanRecorder, label: string, message: string): void {
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
export function changeLines(plan: PlanRecorder): string[] {
  return plan.operations.map((operation) => `${operation.label}: ${operation.description}`);
}

/**
 * Perform a plan's operations one after another, in the order the pass recorded them.
 *
 * @param plan - The plan.
 * @returns The Effect that performs them.
 */
export const performPlan = Effect.fnUntraced(function* (plan: PlanRecorder) {
  for (const operation of plan.operations) {
    yield* operation.perform;
  }
});

/**
 * Plan a run, meet its requirements, and perform the plan when the run applies. The planning
 * pass and the requirements finish before the first operation, so an error in either stops
 * the run with the file untouched. A run that only plans meets the requirements too, so it
 * fails where an apply would.
 *
 * @param apply - Whether to perform the plan or only return it.
 * @param planner - Records the run's operations and warnings into the recorder it is given as
 *   `Plan`.
 * @returns The plan and what the planner returned.
 */
export const runPlan = Effect.fnUntraced(function* <A, E, R>(
  apply: boolean,
  planner: Effect.Effect<A, E, R>
): Effect.fn.Return<PlannedRun<A>, E | PluginError, Exclude<R, Plan>> {
  const plan = newPlan();
  const result = yield* Effect.provideService(planner, Plan, plan);
  yield* meetRequirements(plan);
  if (apply) {
    yield* performPlan(plan);
  }
  return { plan, result };
});
