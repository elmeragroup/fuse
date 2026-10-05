// A named re-export the bundler can tree-shake, so the lazy chunk carries only the Heatmap
// shader; a dynamic import of the package root keeps every shader and preset in it.
export { Heatmap } from "@paper-design/shaders-react";
