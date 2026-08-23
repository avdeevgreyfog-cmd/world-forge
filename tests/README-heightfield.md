# Heightfield baseline tests

The v0.7.1 baseline keeps the v0.7 generator output unchanged while moving the generator into `lib/heightfield/core.ts`.

The reference seed is `481726` with the v0.7 default settings:

- frequency: 4
- octaves: 6
- persistence: 0.52
- redistribution: 1.05
- sea level: 0.50

Reference values used for regression checking:

- Float32 FNV-1a checksum: `1471391727`
- land: `31%`
- min: `0.2056825608210136`
- max: `0.7265650219086217`
- mean: `0.46266782064842815`
- horizontal seam max difference: `0`

These values are intentionally tied to the existing v0.7 implementation so later macrogeometry experiments can be compared against a known baseline.
