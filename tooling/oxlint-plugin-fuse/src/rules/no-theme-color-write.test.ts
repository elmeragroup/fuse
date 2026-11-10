import { ruleTester } from "../rule-tester.ts";
import { noThemeColorWrite } from "./no-theme-color-write.ts";

ruleTester.run("no-theme-color-write", noThemeColorWrite, {
  valid: [
    'const style = { "--chart-color-price": "var(--primary)" };',
    "const style = { [`--chart-color-${key}`]: value };",
    'const fill = "var(--color-primary)";',
    'node.style.setProperty("--chart-color-price", value);',
    { code: 'const style = { "--color-price": "red" };', filename: "chart.test.tsx" },
  ],
  invalid: [
    { code: 'const style = { "--color-price": "var(--primary)" };', errors: [{ messageId: "write" }] },
    { code: "const style = { [`--color-${key}`]: value };", errors: [{ messageId: "write" }] },
    { code: 'node.style.setProperty("--color-primary", value);', errors: [{ messageId: "write" }] },
  ],
});
