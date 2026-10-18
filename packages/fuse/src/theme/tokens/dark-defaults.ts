import type { TokenLayer } from "./contract";
import { NEUTRAL_RING } from "./primitives";

const CHART_ORANGE = "oklch(0.6303 0.1701 47.53)"; // #D86109
const CHART_AQUA = "oklch(0.5698 0.1048 175.23)"; // #0D8B74
const SEQ_2 = "oklch(0.5328 0.1506 255.06)"; // #236CC1
const SEQ_4 = "oklch(0.6902 0.1501 255.12)"; // #569DF6
const SEQ_6 = "oklch(0.8476 0.0705 254.48)"; // #AED0FB

// Shared dark values for roles the supplied palettes lack. Several remain provisional
// until design reviews them.
export const DARK_DEFAULTS = {
  "muted-foreground": "oklch(0.8280204 0.0042636 121.5755)", // #C6C7C4
  error: "oklch(0.8383036 0.089085 26.7575)", // #FFB4AB
  "error-foreground": "oklch(0.3275026 0.1335917 27.3196)", // #690005
  "error-soft": "oklch(0.417061 0.1701528 27.3788)", // #93000A
  "error-soft-foreground": "oklch(0.9182509 0.0417713 25.2259)", // #FFDAD6
  info: "oklch(0.8277984 0.0843922 254.1699)", // #A1CAFD
  "info-foreground": "oklch(0.3106045 0.0851527 248.7497)", // #003259
  "info-soft": "oklch(0.3967775 0.0900793 249.974)", // #1A4975
  "info-soft-foreground": "oklch(0.9138864 0.0417363 258.3723)", // #D2E4FF
  success: "oklch(0.8179521 0.0911921 152.4562)", // #96D5A7
  "success-foreground": "oklch(0.3024656 0.0758299 154.2927)", // #00391C
  "success-soft": "oklch(0.3859182 0.0866613 154.3742)", // #11512E
  "success-soft-foreground": "oklch(0.902421 0.0919972 151.986)", // #B1F1C1
  warning: "oklch(0.8856245 0.0881258 73.4809)", // #FDD198
  "warning-foreground": "oklch(0.3097456 0.0635131 84.6408)", // #3F2D00
  "warning-soft": "oklch(0.3862128 0.0791082 85.4455)", // #574000
  "warning-soft-foreground": "oklch(0.9189171 0.0814924 82.8399)", // #FFE0A6
  border: "oklch(0.3956915 0.0031178 164.9356)", // #454746
  input: "oklch(0.6543689 0.0037291 145.5328)", // #8F918F
  ring: NEUTRAL_RING,
  // Dark modals keep the popover pair. Named here so no dark rule inherits the external light
  // layer's page alias.
  dialog: "var(--popover)",
  "dialog-foreground": "var(--popover-foreground)",
  // The dark steps of the shared chart roles. `defaults.ts` describes each group.
  "chart-1": "oklch(0.6202 0.1856 257.5)", // #3183F3
  "chart-2": CHART_ORANGE, // #D86109
  "chart-3": CHART_AQUA, // #0D8B74
  "chart-4": "oklch(0.6596 0.1809 342.32)", // #D95DB0
  "chart-5": "oklch(0.6611 0.1803 132.54)", // #65A811
  "chart-6": "oklch(0.6194 0.1803 292.62)", // #8C6BE7
  "chart-7": "oklch(0.5553 0.115 79.93)", // #966A00
  "chart-8": "oklch(0.5695 0.185 359.86)", // #C73873
  "chart-other": "oklch(0.6 0 0)", // #808080
  "chart-seq-1": "oklch(0.4562 0.1377 254.82)", // #1156A1
  "chart-seq-2": SEQ_2, // #236CC1
  "chart-seq-3": "oklch(0.6107 0.1503 255.1)", // #3D84DB
  "chart-seq-4": SEQ_4, // #569DF6
  "chart-seq-5": "oklch(0.7689 0.1101 254.81)", // #83B7F9
  "chart-seq-6": SEQ_6, // #AED0FB
  "chart-seq-7": "oklch(0.9255 0.0334 255.21)", // #D8E8FD
  "chart-diverging-1": SEQ_6, // #AED0FB
  "chart-diverging-2": SEQ_4, // #569DF6
  "chart-diverging-3": SEQ_2, // #236CC1
  "chart-diverging-4": "oklch(0.37 0 0)", // #404040
  "chart-diverging-5": "oklch(0.5426 0.1317 50.03)", // #AA5418
  "chart-diverging-6": "oklch(0.6947 0.1503 49.87)", // #E57D3C
  "chart-diverging-7": "oklch(0.8488 0.0841 50.35)", // #FBBE9C
  "chart-sentiment-positive": CHART_AQUA, // #0D8B74
  "chart-sentiment-negative": CHART_ORANGE, // #D86109
  "sh-identifier": "oklch(0.9128668 0.0067833 233.6479)", // #DEE3E6
  "sh-keyword": "oklch(0.8009687 0.1043361 49.42)", // #F5AA81
  "sh-string": "oklch(0.902421 0.0919972 151.986)", // #B1F1C1
  "sh-class": "oklch(0.8299788 0.0546884 280.5235)", // #C0C4EB
  "sh-property": "oklch(0.8201874 0.0815522 220.2343)", // #86D1E9
  "sh-entity": "oklch(0.8856245 0.0881258 73.4809)", // #FDD198
  "sh-jsxliterals": "oklch(0.8156596 0.1022421 190.6206)", // #69D8D2
  "sh-sign": "oklch(0.91205 0.0286161 218.9613)", // #CEE7EF
  "sh-comment": "oklch(0.8280204 0.0042636 121.5755)", // #C6C7C4
} as const satisfies TokenLayer;
