export const W = 512;
export const H = 320;
export const ASPECT = W / H;

export type HeightSettings = {
  frequency: number;
  octaves: number;
  persistence: number;
  redistribution: number;
  sea: number;
};

export type HeightField = {
  values: Float32Array;
  histogram: number[];
  min: number;
  max: number;
  mean: number;
  land: number;
  width: number;
  height: number;
  seamShift: number;
};

export type GeneratorMode = "legacy" | "balanced";
export type MapScope = "world" | "continent";
export type RGB = [number, number, number];

export const OCEAN_COLORS: RGB[] = [
  [44, 46, 73], [66, 75, 130], [79, 106, 184],
  [100, 143, 190], [131, 181, 206], [162, 221, 225],
];
export const LAND_COLORS: RGB[] = [
  [58, 142, 98], [67, 152, 75], [102, 162, 78], [134, 170, 84],
  [162, 177, 89], [185, 176, 94], [192, 163, 104], [211, 175, 145],
  [232, 203, 194], [249, 245, 244],
];

export function hash2(x: number, y: number, seed: number) {
  let h = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const wrap = (v: number, n: number) => ((v % n) + n) % n;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / Math.max(1e-6, b - a));
  return t * t * (3 - 2 * t);
};

export function bandColor(colors: RGB[], t: number): RGB {
  return colors[Math.min(colors.length - 1, Math.floor(clamp(t) * colors.length))];
}
export function reliefColor(h: number, sea: number, min: number, max: number): RGB {
  return h < sea
    ? bandColor(OCEAN_COLORS, (h - min) / Math.max(0.001, sea - min))
    : bandColor(LAND_COLORS, (h - sea) / Math.max(0.001, max - sea));
}

export function gradientNoise(x: number, y: number, seed: number, periodX: number) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
  const dot = (gx: number, gy: number, dx: number, dy: number) => {
    const angle = hash2(wrap(gx, periodX), gy, seed) * Math.PI * 2;
    return Math.cos(angle) * dx + Math.sin(angle) * dy;
  };
  const u = fade(tx), v = fade(ty);
  return mix(
    mix(dot(xi, yi, tx, ty), dot(xi + 1, yi, tx - 1, ty), u),
    mix(dot(xi, yi + 1, tx, ty - 1), dot(xi + 1, yi + 1, tx - 1, ty - 1), u),
    v,
  ) * 1.42;
}

export function fractalNoise(nx: number, ny: number, seed: number, s: HeightSettings) {
  let value = 0, amplitude = 1, total = 0, frequency = s.frequency;
  for (let octave = 0; octave < s.octaves; octave++) {
    value += gradientNoise(
      nx * frequency,
      (ny * frequency) / ASPECT,
      seed + octave * 1013,
      Math.max(1, Math.round(frequency)),
    ) * amplitude;
    total += amplitude;
    amplitude *= s.persistence;
    frequency *= 2;
  }
  return value / total;
}

function balancedNoise(nx: number, ny: number, seed: number, scope: MapScope) {
  const wx = gradientNoise(nx * 2 + 0.37, ny * 1.15 + 0.81, seed + 7001, 2);
  const wy = gradientNoise(nx * 2 + 1.19, ny * 1.10 + 1.73, seed + 7003, 2);
  const sx = nx + wx * (scope === "world" ? 0.055 : 0.065);
  const sy = ny + wy * (scope === "world" ? 0.045 : 0.055);

  let continental: number;
  let regional: number;
  let detail: number;
  let continentalWeight: number;
  let regionalWeightBase: number;
  let detailWeightBase: number;

  if (scope === "world") {
    const a = gradientNoise(sx * 3 + 0.31, sy * 1.85 + 0.67, seed + 101, 3);
    const b = gradientNoise(sx * 4 + 1.17, sy * 2.35 + 1.31, seed + 307, 4);
    const c = gradientNoise(sx * 5 + 1.73, sy * 3.00 + 0.23, seed + 509, 5);
    continental = a * 0.52 + b * 0.31 + c * 0.17;

    const r1 = gradientNoise(sx * 8 + 0.53, sy * 5.0 + 2.17, seed + 907, 8);
    const r2 = gradientNoise(sx * 12 + 2.11, sy * 7.5 + 0.91, seed + 1201, 12);
    regional = r1 * 0.65 + r2 * 0.35;

    const d1 = gradientNoise(sx * 20 + 1.7, sy * 12.5 + 1.3, seed + 1601, 20);
    const d2 = gradientNoise(sx * 32 + 4.1, sy * 20 + 2.7, seed + 1901, 32);
    detail = d1 * 0.65 + d2 * 0.35;

    continentalWeight = 0.58;
    regionalWeightBase = 0.34;
    detailWeightBase = 0.08;
  } else {
    const a = gradientNoise(sx * 2 + 0.31, sy * 1.45 + 0.67, seed + 101, 2);
    const b = gradientNoise(sx * 3 + 1.17, sy * 2.05 + 1.31, seed + 307, 3);
    const c = gradientNoise(sx * 4 + 1.73, sy * 2.65 + 0.23, seed + 509, 4);
    continental = a * 0.54 + b * 0.30 + c * 0.16;

    const r1 = gradientNoise(sx * 7 + 0.53, sy * 4.5 + 2.17, seed + 907, 7);
    const r2 = gradientNoise(sx * 11 + 2.11, sy * 7.0 + 0.91, seed + 1201, 11);
    regional = r1 * 0.64 + r2 * 0.36;

    const d1 = gradientNoise(sx * 20 + 1.7, sy * 12.5 + 1.3, seed + 1601, 20);
    const d2 = gradientNoise(sx * 34 + 4.1, sy * 21 + 2.7, seed + 1901, 34);
    detail = d1 * 0.65 + d2 * 0.35;

    continentalWeight = 0.52;
    regionalWeightBase = 0.38;
    detailWeightBase = 0.10;
  }

  const landInterior = smoothstep(0.025, scope === "world" ? 0.18 : 0.16, continental);
  const oceanInterior = smoothstep(0.025, scope === "world" ? 0.22 : 0.20, -continental);

  // Coastlines retain regional variation, but the highest-frequency component
  // is reduced. Ocean interiors are deliberately smoother than land interiors
  // so bathymetric bands read as basins rather than confetti-like patches.
  const regionalMask = scope === "world"
    ? 0.60 + landInterior * 0.40 + oceanInterior * 0.18
    : 0.65 + landInterior * 0.35 + oceanInterior * 0.15;
  const detailMask = scope === "world"
    ? 0.18 + landInterior * 0.82 + oceanInterior * 0.10
    : 0.24 + landInterior * 0.76 + oceanInterior * 0.08;

  let value =
    continental * continentalWeight +
    regional * regionalWeightBase * regionalMask +
    detail * detailWeightBase * detailMask;

  // Broad deep-ocean bias: depth grows inside ocean basins instead of being
  // driven mainly by high-frequency noise.
  value -= oceanInterior * (scope === "world" ? 0.035 : 0.025);
  return value;
}

function findOceanSeam(values: Float32Array, width: number, height: number, sea: number) {
  const columnScores = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let score = 0;
    let totalWeight = 0;
    for (let y = 0; y < height; y++) {
      const latitude = y / Math.max(1, height - 1);
      const latitudeWeight = Math.max(0.05, Math.pow(Math.sin(Math.PI * latitude), 0.7));
      const value = values[y * width + x];
      score += latitudeWeight * ((value >= sea ? 5 : 0) + value * 0.35);
      totalWeight += latitudeWeight;
    }
    columnScores[x] = score / Math.max(1e-6, totalWeight);
  }

  const radius = Math.max(2, Math.round(width * 0.035));
  let window = 0;
  for (let dx = -radius; dx <= radius; dx++) window += columnScores[wrap(dx, width)];
  let bestScore = window;
  let bestX = 0;
  for (let x = 1; x < width; x++) {
    window -= columnScores[wrap(x - radius - 1, width)];
    window += columnScores[wrap(x + radius, width)];
    if (window < bestScore) {
      bestScore = window;
      bestX = x;
    }
  }
  return bestX;
}

function rotateColumns(values: Float32Array, width: number, height: number, shift: number) {
  if (!shift) return values;
  const rotated = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      rotated[row + x] = values[row + wrap(x + shift, width)];
    }
  }
  return rotated;
}

function buildField(
  seed: number,
  s: HeightSettings,
  sampler: (nx: number, ny: number) => number,
  width = W,
  height = H,
  centerOceanSeam = false,
): HeightField {
  let values = new Float32Array(width * height);
  let min = 1, max = 0, sum = 0, land = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const raw = 0.5 + sampler(nx, ny) * 0.5;
      const elevation = clamp(Math.pow(clamp(raw), s.redistribution));
      const i = y * width + x;
      values[i] = elevation;
      min = Math.min(min, elevation);
      max = Math.max(max, elevation);
      sum += elevation;
      if (elevation >= s.sea) land++;
    }
  }

  const seamShift = centerOceanSeam ? findOceanSeam(values, width, height, s.sea) : 0;
  values = rotateColumns(values, width, height, seamShift);

  const histogram = Array(24).fill(0);
  for (const elevation of values) {
    histogram[Math.min(23, Math.floor(elevation * 24))]++;
  }
  const peak = Math.max(...histogram);

  return {
    values,
    histogram: histogram.map(v => v / peak),
    min,
    max,
    mean: sum / values.length,
    land: Math.round((land / values.length) * 100),
    width,
    height,
    seamShift,
  };
}

export function generateLegacy(seed: number, s: HeightSettings, width = W, height = H): HeightField {
  return buildField(seed, s, (nx, ny) => fractalNoise(nx, ny, seed, s), width, height, false);
}

export function generateBalanced(
  seed: number,
  s: HeightSettings,
  scope: MapScope = "world",
  width = W,
  height = H,
): HeightField {
  return buildField(
    seed,
    s,
    (nx, ny) => balancedNoise(nx, ny, seed, scope),
    width,
    height,
    scope === "world",
  );
}

export function generate(
  seed: number,
  s: HeightSettings,
  mode: GeneratorMode = "legacy",
  scope: MapScope = "world",
  width = W,
  height = H,
): HeightField {
  return mode === "balanced"
    ? generateBalanced(seed, s, scope, width, height)
    : generateLegacy(seed, s, width, height);
}
