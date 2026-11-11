import { ruleTester } from "../rule-tester.ts";
import { noWallClock } from "./no-wall-clock.ts";

ruleTester.run("no-wall-clock", noWallClock, {
  valid: [
    // G1 pair: an installer that is the same API in every alternative is guaranteed.
    'it("a", () => {\n  const install = flag ? vi.useFakeTimers : vi.useFakeTimers;\n  install();\n  const s = Date.now();\n  log(Date.now() - s);\n});',
    // Finding 8 pair: a date constructed under the fake clock keeps its simulated time after a restore.
    'it("a", () => {\n  vi.useFakeTimers();\n  const at = new Date();\n  vi.useRealTimers();\n  log(at.getTime() - start);\n});',
    // Finding 9: an install earlier in the same setup hook covers a read later in it.
    "beforeEach(() => {\n  vi.useFakeTimers();\n  const s = Date.now();\n  log(Date.now() - s);\n});",
    // Finding 5 pair: a hook bound to one API registers its install surely.
    'const hook = beforeEach;\nhook(() => {\n  vi.useFakeTimers();\n});\nit("a", () => {\n  const s = Date.now();\n  log(Date.now() - s);\n});',
    // Finding 7 pair: a reused body every suite fakes is covered at every registration.
    'const body = () => {\n  const s = Date.now();\n  log(Date.now() - s);\n};\ndescribe("a", () => {\n  beforeEach(() => vi.useFakeTimers());\n  it("x", body);\n});\ndescribe("b", () => {\n  beforeEach(() => vi.useFakeTimers());\n  it("y", body);\n});',
    // E2: an install inside a try block runs in order with the body.
    'it("a", () => {\n  try {\n    vi.useFakeTimers();\n    const s = Date.now();\n    log(Date.now() - s);\n  } finally {\n    vi.useRealTimers();\n  }\n});',
    // G2: a fixed date's time is no clock read.
    "const fixed = new Date(0);\nlog(fixed.getTime() - start);",
    // T5: a read under the fake clock stays simulated after the clock is restored.
    'it("a", () => {\n  vi.useFakeTimers();\n  vi.setSystemTime(0);\n  const at = Date.now();\n  vi.useRealTimers();\n  expect(at - 0).toBe(0);\n});',
    // G1: toFake that names Date in every alternative covers Date.
    'it("a", () => {\n  vi.useFakeTimers(flag ? { toFake: ["Date"] } : { toFake: ["Date", "setTimeout"] });\n  const s = Date.now();\n  log(Date.now() - s);\n});',
    // N1: a self-referencing callee resolves to nothing and cannot crash the rule.
    "var now = now.next;\nlog(now() - start);",
    // CQ3: the spread comes last, so its toFake (Date) wins.
    'it("a", () => {\n  const defaults = { toFake: ["Date"] };\n  vi.useFakeTimers({ toFake: ["setTimeout"], ...defaults });\n  const s = Date.now();\n  log(Date.now() - s);\n});',
    // Item 1: toFake names Date, so Date reads are simulated.
    'it("a", () => {\n  vi.useFakeTimers({ toFake: ["Date"] });\n  const start = Date.now();\n  vi.setSystemTime(start + 100);\n  expect(Date.now() - start).toBe(100);\n});',
    // A restore in a teardown hook ends nothing inside the test.
    'afterEach(() => {\n  vi.useRealTimers();\n});\nit("a", () => {\n  vi.useFakeTimers();\n  const start = Date.now();\n  vi.advanceTimersByTime(5);\n  expect(Date.now() - start).toBe(5);\n});',
    // A cycle in a local clock function stops.
    "const now = () => now();\nlog(now() - start);",
    "const scratch = join(tmpdir(), `flags-${Date.now()}`);",
    "await page.clock.pauseAt(Date.now() + 1000);",
    "vi.setSystemTime(Date.now());",
    // A difference of two dates the test wrote is calendar arithmetic, not a measurement.
    "expect(end.getTime() - start.getTime()).toBe(DAY);",
    // T3: under a simulated clock, elapsed time is what the test advanced.
    'it("debounces", () => {\n  vi.useFakeTimers();\n  const start = Date.now();\n  vi.advanceTimersByTime(100);\n  expect(Date.now() - start).toBe(100);\n});',
    'describe("timer", () => {\n  beforeEach(() => {\n    vi.useFakeTimers();\n  });\n  it("waits", () => {\n    const start = performance.now();\n    vi.advanceTimersByTime(50);\n    expect(performance.now() - start).toBe(50);\n  });\n});',
    'it("ticks", async ({ page }) => {\n  await page.clock.install();\n  const start = await page.evaluate(() => Date.now());\n  await page.clock.runFor(1000);\n  expect((await page.evaluate(() => Date.now())) - start).toBe(1000);\n});',
  ],
  invalid: [
    // G1: an installer that may be a no-op is a possible install, which covers nothing.
    {
      code: 'it("a", () => {\n  const install = flag ? vi.useFakeTimers : noop;\n  install();\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Finding 4: a restore that may run intersects coverage away.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers();\n  const restore = flag ? vi.useRealTimers : noop;\n  restore();\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // E2: a restore under a branch is possible and ends coverage.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers();\n  if (flag) vi.useRealTimers();\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // E2: an install under a branch is possible and starts no coverage.
    {
      code: 'it("a", () => {\n  if (flag) vi.useFakeTimers();\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Finding 5: a hook that may be a no-op registers its install possibly.
    {
      code: 'const hook = flag ? beforeEach : noop;\nhook(() => {\n  vi.useFakeTimers();\n});\nit("a", () => {\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // E2: a test registered through a callee that may not be the runner may run without its hooks.
    {
      code: 'const run = flag ? it : direct;\nbeforeEach(() => vi.useFakeTimers());\nrun("a", () => {\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Finding 6: each toFake element counts only when every alternative names the API.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers({ toFake: [flag ? "Date" : "setTimeout"] });\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Finding 2: a spread of alternatives builds one options object per alternative.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers({ ...(flag ? { toFake: ["setTimeout"] } : {}) });\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Finding 7: a reused body is judged at every registration, each with its own suite's hooks.
    {
      code: 'const body = () => {\n  const s = Date.now();\n  log(Date.now() - s);\n};\ndescribe("a", () => {\n  beforeEach(() => vi.useFakeTimers());\n  it("x", body);\n});\ndescribe("b", () => {\n  it("y", body);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Finding 8: a date constructed before the install captured the wall clock.
    {
      code: 'it("a", () => {\n  const at = new Date();\n  vi.useFakeTimers();\n  log(at.getTime() - start);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Finding 9 pair: a read before the hook's own install is on the wall clock.
    {
      code: "beforeEach(() => {\n  const s = Date.now();\n  vi.useFakeTimers();\n  log(Date.now() - s);\n});",
      errors: [{ messageId: "budget" }],
    },
    // G2: a bound new Date() is the current time.
    { code: "const date = new Date();\nlog(date.getTime() - start);", errors: [{ messageId: "budget" }] },
    // G1: one alternative read of the clock is a budget, in either return order.
    {
      code: "function now() {\n  if (flag) return 0;\n  return Date.now();\n}\nlog(now() - start);",
      errors: [{ messageId: "budget" }],
    },
    {
      code: "function now() {\n  if (flag) return Date.now();\n  return 0;\n}\nlog(now() - start);",
      errors: [{ messageId: "budget" }],
    },
    // T5: a read before the fake clock is installed is a wall-clock read, whatever follows.
    {
      code: 'it("a", () => {\n  const at = Date.now();\n  vi.useFakeTimers();\n  expect(at - 1).toBeLessThan(5);\n});',
      errors: [{ messageId: "budget" }],
    },
    // G1: toFake covers only what every alternative fakes.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers(flag ? { toFake: ["Date"] } : { toFake: ["setTimeout"] });\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // T5: page.clock fakes the page's clock, never the test's own Date.
    {
      code: 'it("t", async ({ page }) => {\n  await page.clock.install();\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // N11: global prefixes name the same clock.
    {
      code: "const start = window.performance.now();\nlog(globalThis.performance.now() - start);",
      errors: [{ messageId: "budget" }],
    },
    // CQ3: the own toFake comes last and wins over the spread, so Date stays real.
    {
      code: 'it("a", () => {\n  const defaults = { toFake: ["Date"] };\n  vi.useFakeTimers({ ...defaults, toFake: ["setTimeout"] });\n  const s = Date.now();\n  log(Date.now() - s);\n});',
      errors: [{ messageId: "budget" }],
    },
    // CQ4: the page clock pair: without page.clock, Date.now in the page is the wall clock.
    {
      code: 'it("ticks", async ({ page }) => {\n  const start = await page.evaluate(() => Date.now());\n  expect((await page.evaluate(() => Date.now())) - start).toBe(1000);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Item 14: a local clock function hides nothing.
    {
      code: "const now = () => performance.now();\nconst start = now();\nrender();\nexpect(now() - start).toBeLessThan(50);",
      errors: [{ messageId: "budget" }],
    },
    {
      code: "function now() {\n  const t = Date.now();\n  return t;\n}\nlog(now() - start);",
      errors: [{ messageId: "budget" }],
    },
    // Item 1: a fake clock that leaves an API real does not cover it.
    {
      code: 'it("a", () => {\n  useFakeTimeouts();\n  const start = performance.now();\n  expect(performance.now() - start).toBeLessThan(50);\n});',
      errors: [{ messageId: "budget" }],
    },
    {
      code: 'it("a", () => {\n  vi.useFakeTimers({ toFake: ["setTimeout"] });\n  const start = Date.now();\n  log(Date.now() - start);\n});',
      errors: [{ messageId: "budget" }],
    },
    // Item 1: restoring real timers ends the fake clock from there on.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers();\n  vi.useRealTimers();\n  const start = Date.now();\n  log(Date.now() - start);\n});',
      errors: [{ messageId: "budget" }],
    },
    // An aliased expect still asserts.
    {
      code: 'import { expect as check } from "vitest";\ncheck(performance.now()).toBeLessThan(deadline);',
      errors: [{ messageId: "budget" }],
    },
    {
      code: "const start = performance.now();\nrender();\nexpect(performance.now() - start).toBeLessThan(50);",
      errors: [{ messageId: "budget" }],
    },
    {
      code: "const start = Date.now();\nawait run();\nconst end = Date.now();\nconst elapsed = end - start;",
      errors: [{ messageId: "budget" }],
    },
    {
      code: "const before = new Date().getTime();\nawait run();\nreport(new Date().getTime() - before);",
      errors: [{ messageId: "budget" }],
    },
    { code: "expect(performance.now()).toBeLessThan(deadline);", errors: [{ messageId: "budget" }] },
    {
      code: "const [s] = process.hrtime();\nlog(process.hrtime.bigint() - t0);",
      errors: [{ messageId: "budget" }],
    },
    // An alias of an alias still reads the clock.
    {
      code: "const t0 = Date.now();\nconst start = t0;\nlog(Date.now() - start);",
      errors: [{ messageId: "budget" }],
    },
    // T3: a fake clock in another test leaves this one on the wall clock.
    {
      code: 'it("a", () => {\n  vi.useFakeTimers();\n});\nit("b", () => {\n  const start = Date.now();\n  expect(Date.now() - start).toBeLessThan(5);\n});',
      errors: [{ messageId: "budget" }],
    },
  ],
});
