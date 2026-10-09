---
"@elmeragroup/fuse": minor
---

Add `Slider`, a labeled range control built on Base UI. Import it from
`@elmeragroup/fuse/slider`. It takes NumberField's field props (`label`, `description`,
`errorMessage`, `isInvalid`, `isDisabled`, `minValue`, `maxValue`, `step`, `formatOptions`),
plus `largeStep`, `orientation` and `showValue`. An array of two or more numbers renders one
thumb per entry, and `onChange` reports an array of the same length. A vertical slider fills
its parent's height. Range thumbs take localized "minimum" and "maximum" names, which
`thumbLabels` overrides. A native form reset returns an uncontrolled slider to its
`defaultValue`.
