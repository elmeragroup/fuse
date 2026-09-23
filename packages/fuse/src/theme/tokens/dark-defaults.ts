import type { TokenLayer } from "./contract";

// Shared dark values for roles the supplied palettes lack. PROVENANCE.md records where
// each one came from and which are still provisional.
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
  ring: "oklch(0.8299788 0.0546884 280.5235)", // #C0C4EB
  "chart-1": "oklch(0.8235043 0.0474959 220.6613)", // #A4CDDB
  "chart-2": "oklch(0.8201874 0.0815522 220.2343)", // #86D1E9
  "chart-3": "oklch(0.8156596 0.1022421 190.6206)", // #69D8D2
  "chart-4": "oklch(0.8179521 0.0911921 152.4562)", // #96D5A7
  "chart-5": "oklch(0.902421 0.0919972 151.986)", // #B1F1C1
  "chart-6": "oklch(0.8654171 0.1848336 106.3002)", // #E3D900
  "chart-7": "oklch(0.8856245 0.0881258 73.4809)", // #FDD198
  "chart-8": "oklch(0.8009687 0.1043361 49.42)", // #F5AA81
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
