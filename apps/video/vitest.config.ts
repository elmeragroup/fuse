import tailwindcss from "@tailwindcss/postcss";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // The suite imports the video's own stylesheet, so Fuse's motion classes compile as they
        // do in Remotion's webpack build.
        css: { postcss: { plugins: [tailwindcss()] } },
        // Pre-bundle every dependency the suite reaches up front. A dependency Vite discovers
        // mid-run reloads the page, which can load a second React and fail a cold run.
        optimizeDeps: {
          include: [
            "react",
            "react-dom",
            "react-dom/client",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "remotion",
            "@remotion/layout-utils",
            "tailwind-variants",
            ...[
              "@base-ui/react",
              "@base-ui/react/accordion",
              "@base-ui/react/button",
              "@base-ui/react/dialog",
              "@base-ui/react/drawer",
              "@base-ui/react/input",
              "@base-ui/react/menu",
              "@base-ui/react/merge-props",
              "@base-ui/react/select",
              "@base-ui/react/toolbar",
              "@base-ui/react/tooltip",
              "@base-ui/react/use-render",
              "@internationalized/string",
              "@phosphor-icons/react/dist/ssr/ArrowLeft",
              "@phosphor-icons/react/dist/ssr/CaretDown",
              "@phosphor-icons/react/dist/ssr/CaretRight",
              "@phosphor-icons/react/dist/ssr/CaretUp",
              "@phosphor-icons/react/dist/ssr/Check",
              "@phosphor-icons/react/dist/ssr/MagnifyingGlass",
              "@phosphor-icons/react/dist/ssr/SpinnerGap",
              "@phosphor-icons/react/dist/ssr/X",
              "clsx",
              "tailwind-merge",
            ].map((dependency) => `@elmeragroup/fuse > ${dependency}`),
          ],
        },
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.tsx"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
