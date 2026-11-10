import { ruleTester } from "../rule-tester.ts";
import { noColorLiteral } from "./no-color-literal.ts";

ruleTester.run("no-color-literal", noColorLiteral, {
  valid: [
    'const fill = "var(--chart-color-price)";',
    "const stroke = `color-mix(in oklab, var(--foreground) ${share}%, transparent)`;",
    'const id = "#chart-plot";',
    "// A comment may cite #fff or oklch(0.5 0.1 200).",
    { code: 'const fill = "#5dadec";', filename: "chart.test.tsx" },
  ],
  invalid: [
    { code: 'const fill = "#5dadec";', errors: [{ messageId: "literal" }] },
    { code: 'const mark = <rect fill="#269" />;', errors: [{ messageId: "literal" }] },
    { code: "const stroke = `oklch(0.6 0.1 ${hue})`;", errors: [{ messageId: "literal" }] },
    { code: 'const glow = "rgba(0, 0, 0, 0.2)";', errors: [{ messageId: "literal" }] },
  ],
});
