import { ruleTester } from "../rule-tester.ts";
import { noGeometryAssertions } from "./no-geometry-assertions.ts";

ruleTester.run("no-geometry-assertions", noGeometryAssertions, {
  valid: [
    // Finding 17 pair: every alternative a named constant or zero keeps the exemption.
    "const ROW_WIDTH = 320;\nexpect(panel.offsetWidth).toBe(flag ? ROW_WIDTH : 0);",
    // G2: a distance held in a binding or returned by a local function is still a distance.
    "const delta = Math.abs(a.offsetWidth - b.offsetWidth);\nexpect(delta).toBeLessThan(2);",
    "function gap() {\n  return Math.abs(a.offsetWidth - b.offsetWidth);\n}\nexpect(gap()).toBeLessThan(2);",
    // N10: a returned object's property that is not a measurement.
    "const info = await page.evaluate(() => ({ count: document.images.length }));\nexpect(info.count).toBe(3);",
    // Relations between measurements hold at any viewport.
    "const closed = root.getBoundingClientRect().height;\nawait open();\nexpect(root.getBoundingClientRect().height).toBe(closed);",
    "expect(find().getBoundingClientRect().top - paragraph.bottom).toBeGreaterThan(0);",
    "const line = px(getComputedStyle(text).lineHeight);\nexpect(text.getBoundingClientRect().height).toBeLessThan(line * 2);",
    "expect(title.getBoundingClientRect().top - content.getBoundingClientRect().top).toBeCloseTo(0, 2);",
    "expect(description.scrollHeight).toBe(description.clientHeight);",
    // A shared, named contract constant.
    'import { TARGET_SIZE } from "../../../test/target-size";\nexpect(box.getBoundingClientRect().width).toBeGreaterThanOrEqual(TARGET_SIZE);',
    // Declared computed values are not layout measurements.
    'expect(getComputedStyle(link).color).toBe(cssVarColor(link, "--brand"));',
    "expect(px(getComputedStyle(row).paddingInline)).toBe(12);",
    "expect(items.length).toBe(3);",
    // A named constant states the relation: the fixture's row width, the shared target floor.
    "const ROW_WIDTH = 320;\nexpect(cell.getBoundingClientRect().width).toBeLessThanOrEqual(ROW_WIDTH);",
    "expect(Math.abs(popupMiddle - pointer.y)).toBeGreaterThan(HIT_RADIUS * 1);",
    "expect(Math.abs(into - 70)).toBeGreaterThan(24);",
    // A tolerance on the distance between two edges is alignment, not a pin.
    "expect.soft(Math.abs(link.top - box.getBoundingClientRect().top), name).toBeLessThan(2);",
    // T11: a sign or a ratio of lengths is no length.
    "expect(Math.sign(viewport.scrollTop)).toBe(1);",
    "expect(box.getBoundingClientRect().width / box.getBoundingClientRect().height).toBeCloseTo(1.5);",
    // Item 10: two reads of one binding are both lengths; their ratio is no length.
    "const box = panel.getBoundingClientRect();\nexpect(box.width / box.height).toBeCloseTo(1.5);",
    "const ratio = panel.offsetWidth / panel.offsetHeight;\nexpect(ratio).toBeCloseTo(1.5);",
    "const w = (el) => el.getBoundingClientRect().width;\nexpect(w(a) / w(b)).toBeCloseTo(2);",
    // T12: a binding that refers to itself resolves to nothing and cannot crash the rule.
    "var box = box;\nexpect(box.height).toBe(36);",
    // Item 13: an evaluate callback that returns no measurement.
    "expect(await page.evaluate(() => document.title.length)).toBe(5);",
    // T7: a zero pixel string pins nothing.
    'expect(getComputedStyle(popup).top).toBe("0px");',
  ],
  invalid: [
    // Finding 3: a member read of alternatives, one of which is a measurement.
    {
      code: "expect((flag ? el : { offsetWidth: 0 }).offsetWidth).toBe(320);",
      errors: [{ messageId: "pixel" }],
    },
    // Finding 17: an expected value with a pixel alternative pins.
    {
      code: "expect(panel.offsetWidth).toBe(flag ? 320 : 0);",
      errors: [{ messageId: "pixel" }],
    },
    // G1: the distance exemption needs every alternative to be a distance.
    {
      code: "const d = flag ? Math.abs(a.offsetWidth - b.offsetWidth) : a.offsetWidth;\nexpect(d).toBeLessThan(2);",
      errors: [{ messageId: "pixel" }],
    },
    // G2: matcher and modifier keys read as static keys.
    { code: 'expect(panel.offsetWidth)["toBe"](320);', errors: [{ messageId: "pixel" }] },
    { code: 'expect(panel.offsetWidth)["not"]["toBe"](320);', errors: [{ messageId: "pixel" }] },
    // T14: a bracketed evaluate member.
    {
      code: 'expect(await page["evaluate"](() => document.body.offsetWidth)).toBe(320);',
      errors: [{ messageId: "pixel" }],
    },
    // N10: an evaluate callback's returned object keeps its property's provenance.
    {
      code: "const box = await page.evaluate(() => ({ width: document.body.offsetWidth }));\nexpect(box.width).toBe(320);",
      errors: [{ messageId: "pixel" }],
    },
    {
      code: "const sizeOf = (el) => ({ width: el.offsetWidth });\nexpect(sizeOf(panel).width).toBe(320);",
      errors: [{ messageId: "pixel" }],
    },
    {
      code: "expect(description.top - title.getBoundingClientRect().bottom).toBeCloseTo(4, 2);",
      errors: [{ messageId: "pixel" }],
    },
    {
      code: "const box = button.getBoundingClientRect();\nexpect(box.width).toBeGreaterThanOrEqual(24);",
      errors: [{ messageId: "pixel" }],
    },
    {
      code: "const { height } = panel.getBoundingClientRect();\nexpect(height).toBe(240);",
      errors: [{ messageId: "pixel" }],
    },
    { code: "expect(viewport.scrollLeft).toBe(-320);", errors: [{ messageId: "pixel" }] },
    {
      code: "expect(px(getComputedStyle(popup).width)).toBeCloseTo(280, 0);",
      errors: [{ messageId: "pixel" }],
    },
    {
      code: 'function mediaBox(alt) {\n  return image(alt).getBoundingClientRect();\n}\nexpect(mediaBox("a").height).toBe(90);',
      errors: [{ messageId: "pixel" }],
    },
    {
      code: "expect(popup.getBoundingClientRect()).toMatchObject({ width: 320 });",
      errors: [{ messageId: "pixel" }],
    },
    { code: "await expect.poll(() => list.scrollHeight).toBe(400);", errors: [{ messageId: "pixel" }] },
    // Item 10: a helper called twice is measured both times.
    {
      code: "const w = (el) => el.getBoundingClientRect().width;\nexpect(w(a) + w(b)).toBe(240);",
      errors: [{ messageId: "pixel" }],
    },
    // Item 10: a real cycle stops, and the measured value beside it still pins.
    {
      code: "const loop = () => loop();\nexpect(loop() + panel.offsetWidth).toBe(240);",
      errors: [{ messageId: "pixel" }],
    },
    // Item 13: a page evaluate callback's return.
    {
      code: "expect(await page.evaluate(() => document.body.offsetWidth)).toBe(320);",
      errors: [{ messageId: "pixel" }],
    },
    {
      code: "expect(await button.evaluate((el) => {\n  const box = el.getBoundingClientRect();\n  return box.height;\n})).toBe(36);",
      errors: [{ messageId: "pixel" }],
    },
    // Item 3: an aliased expect still asserts.
    {
      code: 'import { expect as check } from "vitest";\ncheck(panel.offsetWidth).toBe(320);',
      errors: [{ messageId: "pixel" }],
    },
    // T7: a computed length as a pixel string.
    { code: 'expect(getComputedStyle(button).height).toBe("36px");', errors: [{ messageId: "pixel" }] },
    // T8: a poll callback that sets up a binding before it returns.
    {
      code: "await expect.poll(() => {\n  const box = button.getBoundingClientRect();\n  return box.height;\n}).toBe(36);",
      errors: [{ messageId: "pixel" }],
    },
    // Q1: a helper's return, through an expression body and through a block body.
    {
      code: "const heightOf = (el) => el.getBoundingClientRect().height;\nexpect(heightOf(button)).toBe(36);",
      errors: [{ messageId: "pixel" }],
    },
    {
      code: "function heightOf(el) {\n  const box = el.getBoundingClientRect();\n  return box.height;\n}\nexpect(heightOf(button)).toBe(36);",
      errors: [{ messageId: "pixel" }],
    },
    // Lengths kept through rounding and a scale factor.
    { code: "expect(Math.round(panel.offsetWidth * 2)).toBe(640);", errors: [{ messageId: "pixel" }] },
  ],
});
