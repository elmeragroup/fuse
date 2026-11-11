import { ruleTester } from "../rule-tester.ts";
import { noFixedDelay } from "./no-fixed-delay.ts";

ruleTester.run("no-fixed-delay", noFixedDelay, {
  valid: [
    // Finding 9: an install earlier in the same setup hook covers a wait later in it.
    "beforeEach(() => {\n  vi.useFakeTimers();\n  setTimeout(fire, 100);\n});",
    // G2: a test body bound to a name is the test, and its clock install counts.
    'const body = () => {\n  vi.useFakeTimers();\n  setTimeout(fire, 100);\n};\nit("x", body);',
    // G2: the hooks around the call that registers a bound body apply to it.
    'const body = () => {\n  setTimeout(fire, 100);\n};\ndescribe("s", () => {\n  beforeEach(() => {\n    vi.useFakeTimers();\n  });\n  it("x", body);\n});',
    // T2: a restore inside a nested function never counts, called or not.
    'it("a", () => {\n  vi.useFakeTimers();\n  const off = () => vi.useRealTimers();\n  setTimeout(fire, 100);\n});',
    // CQ-P2-4: every alternative is zero.
    "function pick() {\n  if (flag) return 0;\n  return 0;\n}\nawait sleep(pick());",
    // N1: a self-referencing callee resolves to nothing and cannot crash the rule.
    "var wait = wait.next;\nwait(100);",
    // N2: a poll on state the loop reassigns.
    'let status = "pending";\nwhile (status !== "ready") {\n  await sleep(50);\n  status = await getStatus();\n}',
    // N7: hooks run outer suite first, so the inner install wins over the outer restore.
    'describe("outer", () => {\n  describe("inner", () => {\n    beforeEach(() => {\n      vi.useFakeTimers();\n    });\n    it("t", () => {\n      setTimeout(fire, 100);\n    });\n  });\n  beforeEach(() => {\n    vi.useRealTimers();\n  });\n});',
    // N8: a helper only faked tests call through an alias is covered.
    'function wait() {\n  return new Promise((r) => setTimeout(r, 100));\n}\nconst waitFake = wait;\nit("fake", async () => {\n  vi.useFakeTimers();\n  await waitFake();\n});',
    // N9: hooks and vi under a namespace import.
    'import * as vt from "vitest";\nvt.describe("s", () => {\n  vt.beforeEach(() => {\n    vt.vi.useFakeTimers();\n  });\n  vt.it("t", () => {\n    setTimeout(fire, 100);\n  });\n});',
    // One macrotask turn: ordering, not a guess at duration.
    "await new Promise((resolve) => setTimeout(resolve, 0));",
    "await new Promise((resolve) => setTimeout(resolve));",
    "setTimeout(() => step());",
    // T2: a poll repeats until its condition holds.
    "while (!done) {\n  await new Promise((resolve) => setTimeout(resolve, 20));\n}",
    "function* survivors() {\n  for (let i = 0; i < 30 && alive(pid); i += 1) {\n    yield* Effect.sleep(Duration.millis(100));\n  }\n}",
    "for (const attempt of ATTEMPTS) {\n  if (await ready()) break;\n  await sleep(50);\n}",
    // A wrapper forwards its caller's delay.
    "const counted = (handler, delay) => setTimeout(handler, delay);",
    // Effect.sleep under it.effect runs on the test clock.
    'it.effect("retries", () => Effect.gen(function* () {\n  yield* Effect.sleep("1 second");\n}));',
    "vi.advanceTimersByTime(500);",
    "const NONE = 0;\nawait sleep(NONE);",
    // T2: a poll on a flag, and an early exit on a checked condition.
    "let done = false;\nwhile (!done) {\n  await sleep(20);\n  done = await ready();\n}",
    "while (true) {\n  if (await ready()) break;\n  await sleep(20);\n}",
    // T3: a helper only faked tests call is covered by their clock.
    'function wait() {\n  return new Promise((r) => setTimeout(r, 100));\n}\nit("fake", async () => {\n  vi.useFakeTimers();\n  const p = wait();\n  await vi.advanceTimersByTimeAsync(100);\n  await p;\n});',
    // Item 1: the repo helper fakes the timers.
    'it("a", () => {\n  useFakeTimeouts();\n  setTimeout(fire, 100);\n});',
    'it("a", () => {\n  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });\n  setTimeout(fire, 100);\n});',
    // T3: a simulated clock makes the timer's delay simulated time.
    'it("debounces", () => {\n  vi.useFakeTimers();\n  setTimeout(fire, 100);\n  vi.advanceTimersByTime(100);\n});',
    'describe("toast", () => {\n  beforeEach(() => {\n    vi.useFakeTimers();\n  });\n  it("closes", async () => {\n    setTimeout(close, 5000);\n  });\n});',
  ],
  invalid: [
    // G1: a wait under a possible install is a real wait.
    {
      code: 'it("a", () => {\n  const install = flag ? vi.useFakeTimers : noop;\n  install();\n  setTimeout(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // Finding 5: a hook that may be a no-op does not cover the wait.
    {
      code: 'const hook = flag ? beforeEach : noop;\nhook(() => vi.useFakeTimers());\nit("a", () => {\n  setTimeout(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // Finding 9 pair: a wait before the hook's own install is real.
    {
      code: "beforeEach(() => {\n  setTimeout(fire, 100);\n  vi.useFakeTimers();\n});",
      errors: [{ messageId: "delay" }],
    },
    // G1: a callee that may be setTimeout, in either return order.
    {
      code: "function pick() {\n  if (flag) return noop;\n  return setTimeout;\n}\npick()(fire, 100);",
      errors: [{ messageId: "delay" }],
    },
    {
      code: "function pick() {\n  if (flag) return setTimeout;\n  return noop;\n}\npick()(fire, 100);",
      errors: [{ messageId: "delay" }],
    },
    // N6/T3: toFake clearTimeout alone fakes nothing.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers({ toFake: ["clearTimeout"] });\n  setTimeout(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // T2: an install inside a nested function never counts, called or not.
    {
      code: 'it("a", () => {\n  function install() {\n    vi.useFakeTimers();\n  }\n  setTimeout(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'it("a", () => {\n  const install = () => vi.useFakeTimers();\n  install();\n  setTimeout(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // T4: a later install replaces the earlier one's coverage.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers();\n  vi.useFakeTimers({ toFake: ["Date"] });\n  setTimeout(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // T6: a global timer through a local alias or an object property.
    { code: "const later = setTimeout;\nlater(fire, 100);", errors: [{ messageId: "delay" }] },
    {
      code: "const timers = { later: setTimeout };\ntimers.later(fire, 100);",
      errors: [{ messageId: "delay" }],
    },
    // CQ-P2-4: one non-zero alternative makes the delay real, in either return order.
    {
      code: "function pick() {\n  if (flag) return 0;\n  return 100;\n}\nawait sleep(pick());",
      errors: [{ messageId: "delay" }],
    },
    {
      code: "function pick() {\n  if (flag) return 100;\n  return 0;\n}\nawait sleep(pick());",
      errors: [{ messageId: "delay" }],
    },
    // N9 pair: a namespace hook that restores real timers leaves the test waiting for real.
    {
      code: 'import * as vt from "vitest";\nvt.describe("s", () => {\n  vt.beforeEach(() => {\n    vt.vi.useFakeTimers();\n    vt.vi.useRealTimers();\n  });\n  vt.it("t", () => {\n    setTimeout(fire, 100);\n  });\n});',
      errors: [{ messageId: "delay" }],
    },
    // N2: a countdown is a counter, not a condition.
    { code: "let i = 3;\nwhile (i--) {\n  await sleep(100);\n}", errors: [{ messageId: "delay" }] },
    // N6: faking setInterval leaves setTimeout real.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });\n  setTimeout(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // N7: the outer install runs first and the inner restore after it, whatever the source order.
    {
      code: 'describe("outer", () => {\n  describe("inner", () => {\n    beforeEach(() => {\n      vi.useRealTimers();\n    });\n    it("t", () => {\n      setTimeout(fire, 100);\n    });\n  });\n  beforeEach(() => {\n    vi.useFakeTimers();\n  });\n});',
      errors: [{ messageId: "delay" }],
    },
    // N8: a real test that calls the helper through its alias waits for real.
    {
      code: 'function wait() {\n  return new Promise((r) => setTimeout(r, 100));\n}\nconst waitFake = wait;\nit("fake", async () => {\n  vi.useFakeTimers();\n  await wait();\n});\nit("real", async () => {\n  await waitFake();\n});',
      errors: [{ messageId: "delay" }],
    },
    // N11: a global prefix names the same timer.
    { code: "window.setTimeout(fire, 100);", errors: [{ messageId: "delay" }] },
    { code: "globalThis.setTimeout(fire, 100);", errors: [{ messageId: "delay" }] },
    // N12: callback timers imported from node:timers, aliases included, wait for real even under a fake clock.
    {
      code: 'import { setTimeout } from "node:timers";\nsetTimeout(fire, 100);',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { setTimeout as later } from "timers";\nit("a", () => {\n  vi.useFakeTimers();\n  later(fire, 100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // N13: a key destructured from a namespace import of the promise timers.
    {
      code: 'import * as timers from "node:timers/promises";\nconst { setTimeout: wait } = timers;\nawait wait(100);',
      errors: [{ messageId: "delay" }],
    },
    { code: "await new Promise((resolve) => setTimeout(resolve, 100));", errors: [{ messageId: "delay" }] },
    { code: "await new Promise((r) => { setTimeout(() => r(), 50); });", errors: [{ messageId: "delay" }] },
    { code: "setTimeout(() => button.click(), 200);", errors: [{ messageId: "delay" }] },
    {
      code: 'import { setTimeout } from "node:timers/promises";\nawait setTimeout(100);',
      errors: [{ messageId: "delay" }],
    },
    // An aliased import is the same timer.
    {
      code: 'import { setTimeout as wait } from "node:timers/promises";\nawait wait(100);',
      errors: [{ messageId: "delay" }],
    },
    { code: "await sleep(250);", errors: [{ messageId: "delay" }] },
    { code: "const SETTLE = 300;\nawait delay(SETTLE);", errors: [{ messageId: "delay" }] },
    { code: "await page.waitForTimeout(1000);", errors: [{ messageId: "delay" }] },
    {
      code: 'it.live("waits", () => Effect.gen(function* () {\n  yield* Effect.sleep(Duration.millis(200));\n}));',
      errors: [{ messageId: "delay" }],
    },
    // A loop around the test does not make a delay inside its own callback a poll.
    {
      code: "for (const row of rows) {\n  it(row, async () => {\n    await sleep(100);\n  });\n}",
      errors: [{ messageId: "delay" }],
    },
    // T2: a loop over items is not a poll: it waits a fixed time per item.
    {
      code: "for (const name of names) {\n  await sleep(100);\n  await check(name);\n}",
      errors: [{ messageId: "delay" }],
    },
    {
      code: "for (let i = 0; i < 3; i += 1) {\n  await sleep(100);\n}",
      errors: [{ messageId: "delay" }],
    },
    // T3: a fake clock in another test leaves this one waiting for real.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers();\n});\nit("b", async () => {\n  await sleep(100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // T2: a counter is no condition.
    { code: "let i = 0;\nwhile (i++ < 3) {\n  await sleep(100);\n}", errors: [{ messageId: "delay" }] },
    {
      code: "for (let attempt = 0; attempt < MAX; attempt += 1) {\n  await sleep(100);\n}",
      errors: [{ messageId: "delay" }],
    },
    {
      code: "for (const name of names) {\n  if (count++ > 3) break;\n  await sleep(100);\n}",
      errors: [{ messageId: "delay" }],
    },
    // Item 8: a namespace import of the promise timers.
    {
      code: 'import * as timers from "node:timers/promises";\nawait timers.setTimeout(100);',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { scheduler } from "node:timers/promises";\nawait scheduler.wait(100);',
      errors: [{ messageId: "delay" }],
    },
    // Item 1: a fake clock that fakes only Date leaves the timers real.
    {
      code: 'it("a", async () => {\n  vi.useFakeTimers({ toFake: ["Date"] });\n  await sleep(1000);\n});',
      errors: [{ messageId: "delay" }],
    },
    // Item 1: restoring real timers ends the fake clock.
    {
      code: 'it("a", async () => {\n  vi.useFakeTimers();\n  vi.useRealTimers();\n  await sleep(100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // A promise timer waits for real under a fake clock.
    {
      code: 'import { setTimeout as wait } from "node:timers/promises";\nit("a", async () => {\n  vi.useFakeTimers();\n  await wait(100);\n});',
      errors: [{ messageId: "delay" }],
    },
    // T3: a helper that a faked test and a real test both call waits for real in the second.
    {
      code: 'function wait() {\n  return new Promise((r) => setTimeout(r, 100));\n}\nit("fake", async () => {\n  vi.useFakeTimers();\n  await wait();\n});\nit("real", async () => {\n  await wait();\n});',
      errors: [{ messageId: "delay" }],
    },
    // T12: a binding that refers to itself resolves to nothing and cannot crash the rule.
    { code: "var delay = delay;\nawait sleep(delay);", errors: [{ messageId: "delay" }] },
  ],
});
