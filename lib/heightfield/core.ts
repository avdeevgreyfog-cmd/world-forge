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
};

export type GeneratorMode = "legacy" | "macro";
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

function macroNoise(nx: number, ny: number, seed: number) {
  const wx = gradientNoise(nx * 2 + 0.37, ny * 1.12 + 0.81, seed + 7001, 2);
  const wy = gradientNoise(nx * 2 + 1.19, ny * 1.05 + 1.73, seed + 7003, 2);
  const sx = nx + wx * 0.085;
  const sy = ny + wy * 0.065;

  const a = gradientNoise(sx * 2 + 0.31, sy * 1.28 + 0.67, seed + 101, 2);
  const b = gradientNoise(sx * 3 + 1.17, sy * 1.75 + 1.31, seed + 307, 3);
  const c = gradientNoise(sx * 2 + 1.73, sy * 2.35 + 0.23, seed + 509, 2);
  const continental = a * 0.52 + b * 0.30 + c * 0.18;

  const r1 = gradientNoise(sx * 5 + 0.53, sy * 3.55 + 2.17, seed + 907, 5);
  const r2 = gradientNoise(sx * 7 + 2.11, sy * 4.65 + 0.91, seed + 1201, 7);
  const regional = r1 * 0.68 + r2 * 0.32;

  const d1 = gradientNoise(sx * 11 + 1.7, sy * 7.2 + 1.3, seed + 1601, 11);
  const d2 = gradientNoise(sx * 19 + 4.1, sy * 12.5 + 2.7, seed + 1901, 19);
  const detail = d1 * 0.67 + d2 * 0.33;

  // Near the macro coastline, keep regional deformation but suppress the
  // highest-frequency signal so the coast stays varied without fragmenting.
  const interior = smoothstep(0.035, 0.19, Math.abs(continental));
  const regionalWeight = 0.48 + interior * 0.52;
  const detailWeight = 0.16 + interior * 0.84;

  return continental * 0.65 + regional * 0.28 * regionalWeight + detail * 0.07 * detailWeight;
}

function buildField(seed: number, s: HeightSettings, sampler: (nx: number, ny: number) => number): HeightField {
  const values = new Float32Array(W * H);
  const histogram = Array(24).fill(0);
  let min = 1, max = 0, sum = 0, land = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / (W - 1), ny = y / (H - 1);
      const raw = 0.5 + sampler(nx, ny) * 0.5;
      const elevation = clamp(Math.pow(clamp(raw), s.redistribution));
      const i = y * W + x;
      values[i] = elevation;
      min = Math.min(min, elevation); max = Math.max(max, elevation); sum += elevation;
      if (elevation >= s.sea) land++;
      histogram[Math.min(23, Math.floor(elevation * 24))]++;
    }
  }
  const peak = Math.max(...histogram);
  return {
    values,
    histogram: histogram.map(v => v / peak),
    min, max, mean: sum / values.length,
    land: Math.round((land / values.length) * 100),
  };
}

export function generateLegacy(seed: number, s: HeightSettings): HeightField {
  return buildField(seed, s, (nx, ny) => fractalNoise(nx, ny, seed, s));
}

export function generateMacro(seed: number, s: HeightSettings): HeightField {
  return buildField(seed, s, (nx, ny) => macroNoise(nx, ny, seed));
}

export function generate(seed: number, s: HeightSettings, mode: GeneratorMode = "legacy"): HeightField {
  return mode === "macro" ? generateMacro(seed, s) : generateLegacy(seed, s);
}
