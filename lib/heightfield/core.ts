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

export type RGB = [number, number, number];

export const OCEAN_COLORS: RGB[] = [
  [44, 46, 73],
  [66, 75, 130],
  [79, 106, 184],
  [100, 143, 190],
  [131, 181, 206],
  [162, 221, 225],
];

export const LAND_COLORS: RGB[] = [
  [58, 142, 98],
  [67, 152, 75],
  [102, 162, 78],
  [134, 170, 84],
  [162, 177, 89],
  [185, 176, 94],
  [192, 163, 104],
  [211, 175, 145],
  [232, 203, 194],
  [249, 245, 244],
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

export function bandColor(colors: RGB[], t: number): RGB {
  return colors[Math.min(colors.length - 1, Math.floor(clamp(t) * colors.length))];
}

export function reliefColor(h: number, sea: number, min: number, max: number): RGB {
  return h < sea
    ? bandColor(OCEAN_COLORS, (h - min) / Math.max(0.001, sea - min))
    : bandColor(LAND_COLORS, (h - sea) / Math.max(0.001, max - sea));
}

export function gradientNoise(x: number, y: number, seed: number, periodX: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const dot = (gx: number, gy: number, dx: number, dy: number) => {
    const angle = hash2(wrap(gx, periodX), gy, seed) * Math.PI * 2;
    return Math.cos(angle) * dx + Math.sin(angle) * dy;
  };
  const u = fade(tx);
  const v = fade(ty);
  return mix(
    mix(dot(xi, yi, tx, ty), dot(xi + 1, yi, tx - 1, ty), u),
    mix(dot(xi, yi + 1, tx, ty - 1), dot(xi + 1, yi + 1, tx - 1, ty - 1), u),
    v,
  ) * 1.42;
}

export function fractalNoise(nx: number, ny: number, seed: number, s: HeightSettings) {
  let value = 0;
  let amplitude = 1;
  let total = 0;
  let frequency = s.frequency;
  for (let octave = 0; octave < s.octaves; octave++) {
    value +=
      gradientNoise(
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

export function generate(seed: number, s: HeightSettings): HeightField {
  const values = new Float32Array(W * H);
  const histogram = Array(24).fill(0);
  let min = 1;
  let max = 0;
  let sum = 0;
  let land = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / (W - 1);
      const ny = y / (H - 1);
      const raw = 0.5 + fractalNoise(nx, ny, seed, s) * 0.5;
      const elevation = clamp(Math.pow(clamp(raw), s.redistribution));
      const i = y * W + x;
      values[i] = elevation;
      min = Math.min(min, elevation);
      max = Math.max(max, elevation);
      sum += elevation;
      if (elevation >= s.sea) land++;
      histogram[Math.min(23, Math.floor(elevation * 24))]++;
    }
  }

  const peak = Math.max(...histogram);
  return {
    values,
    histogram: histogram.map((v) => v / peak),
    min,
    max,
    mean: sum / values.length,
    land: Math.round((land / values.length) * 100),
  };
}
