# World Forge verification scripts

- `node scripts/heightfield-baseline.mjs` verifies the exact v0.7 reference seed output.
- `node scripts/heightfield-qa.mjs` runs a 100-seed low-resolution baseline batch and reports macro statistics for comparison with future algorithms.

These scripts intentionally do not change the UI or generator behavior.
