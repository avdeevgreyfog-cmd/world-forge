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

export type WorldSettings = {
  landTarget: number;
  continentCount: number;
  coastComplexity: number;
  candidates: number;
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
  candidateIndex?: number;
  candidateSeed?: number;
  candidateScore?: number;
};

export type GeneratorMode = "legacy" | "world";
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

function hash3(a: number, b: number, c: number, seed: number) {
  let h = Math.imul((a | 0) ^ seed, 1597334677);
  h = (h + Math.imul((b | 0) ^ (seed >>> 1), 3812015801)) | 0;
  h = (h + Math.imul((c | 0) ^ (seed << 1), 958689913)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
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

function worldLegacyNoise(nx: number, ny: number, seed: number) {
  const fixed: HeightSettings = {frequency: 4, octaves: 6, persistence: 0.52, redistribution: 1, sea: 0.5};
  return fractalNoise(nx, ny, seed, fixed);
}

class MinHeap {
  private data: Array<{p: number; x: number; y: number}> = [];
  get size() { return this.data.length; }
  push(item: {p: number; x: number; y: number}) {
    const a = this.data;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].p <= item.p) break;
      a[i] = a[parent];
      i = parent;
    }
    a[i] = item;
  }
  pop() {
    const a = this.data;
    if (!a.length) return undefined;
    const root = a[0];
    const last = a.pop()!;
    if (a.length) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        if (left >= a.length) break;
        const right = left + 1;
        const child = right < a.length && a[right].p < a[left].p ? right : left;
        if (a[child].p >= last.p) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = last;
    }
    return root;
  }
}

function makeRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let z = t;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function growContinents(seed: number, settings: WorldSettings, gw = 96, gh = 60) {
  const rng = makeRng(seed);
  const n = Math.max(2, Math.min(6, Math.round(settings.continentCount)));
  const margin = Math.max(5, Math.round(gw * 0.075));
  const seeds: Array<{x: number; y: number; angle: number; elongation: number}> = [];
  const minSeparation = Math.max(10, Math.round(Math.min(gw, gh) * 0.22));

  for (let i = 0; i < n; i++) {
    let chosen = {x: margin + 2, y: 6};
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = margin + 2 + Math.floor(rng() * Math.max(1, gw - margin * 2 - 4));
      const y = 5 + Math.floor(rng() * Math.max(1, gh - 10));
      let ok = true;
      for (const other of seeds) {
        const dx = x - other.x;
        const dy = (y - other.y) * 1.25;
        if (dx * dx + dy * dy < minSeparation * minSeparation) { ok = false; break; }
      }
      chosen = {x, y};
      if (ok) break;
    }
    seeds.push({...chosen, angle: rng() * Math.PI * 2, elongation: 0.72 + rng() * 0.82});
  }

  const labels = new Int16Array(gw * gh);
  const blocked = new Uint8Array(gw * gh);
  const counts = new Int32Array(n);
  const weights = new Float64Array(n);
  let weightSum = 0;
  for (let i = 0; i < n; i++) { weights[i] = 0.75 + rng() * 0.60; weightSum += weights[i]; }
  const totalTarget = Math.round(gw * gh * clamp(settings.landTarget / 100));
  const targets = new Int32Array(n);
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    targets[i] = Math.max(40, Math.round(totalTarget * weights[i] / weightSum));
    assigned += targets[i];
  }
  targets[n - 1] += totalTarget - assigned;

  const heaps = Array.from({length: n}, () => new MinHeap());
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;
  for (let i = 0; i < n; i++) {
    const s = seeds[i];
    labels[s.y * gw + s.x] = i + 1;
    counts[i] = 1;
    for (const [dx, dy] of neighbors) {
      const x = s.x + dx, y = s.y + dy;
      if (x >= 0 && x < gw && y >= 0 && y < gh) heaps[i].push({p: 0, x, y});
    }
  }

  let guard = 0;
  while (guard++ < gw * gh * 12) {
    let unfinished = false;
    for (let ci = 0; ci < n; ci++) {
      if (counts[ci] >= targets[ci]) continue;
      unfinished = true;
      const heap = heaps[ci];
      let added = false;
      while (heap.size) {
        const item = heap.pop()!;
        const {x, y} = item;
        const index = y * gw + x;
        if (labels[index] !== 0 || blocked[index]) continue;
        if (x < margin || x >= gw - margin) continue;

        let touchesOther = false;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= gw || yy < 0 || yy >= gh) continue;
          const label = labels[yy * gw + xx];
          if (label > 0 && label !== ci + 1) { touchesOther = true; break; }
        }
        if (touchesOther) { blocked[index] = 1; continue; }

        labels[index] = ci + 1;
        counts[ci]++;
        added = true;
        const s = seeds[ci];
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
        for (const [dx, dy] of neighbors) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= gw || yy < 0 || yy >= gh) continue;
          const ni = yy * gw + xx;
          if (labels[ni] !== 0 || blocked[ni]) continue;
          const rx = xx - s.x, ry = yy - s.y;
          const along = rx * ca + ry * sa;
          const cross = -rx * sa + ry * ca;
          const dist = Math.sqrt(Math.pow(along / Math.max(0.45, s.elongation), 2) + Math.pow(cross * s.elongation, 2));
          const nx = xx / Math.max(1, gw - 1);
          const ny = yy / Math.max(1, gh - 1);
          const broadNoise = gradientNoise(nx * 5, ny * 3.1, seed + ci * 313 + 17, 5);
          const jitter = hash3(xx, yy, ci, seed) - 0.5;
          const priority = dist * 0.035 + broadNoise * 0.22 + jitter * 0.18;
          heap.push({p: priority, x: xx, y: yy});
        }
        break;
      }
      if (!added && !heap.size) counts[ci] = targets[ci];
    }
    if (!unfinished) break;
  }

  const mask = new Uint8Array(gw * gh);
  for (let i = 0; i < mask.length; i++) mask[i] = labels[i] > 0 ? 1 : 0;
  return {mask, width: gw, height: gh};
}

function signedDistance(mask: Uint8Array, width: number, height: number) {
  const dist = new Float32Array(mask.length);
  dist.fill(1e9);
  const q = new Int32Array(mask.length);
  let head = 0, tail = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let boundary = false;
      const value = mask[i];
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) boundary = true;
      else if (mask[i - 1] !== value || mask[i + 1] !== value || mask[i - width] !== value || mask[i + width] !== value) boundary = true;
      if (boundary) { dist[i] = 0; q[tail++] = i; }
    }
  }
  while (head < tail) {
    const i = q[head++];
    const x = i % width, y = Math.floor(i / width);
    const nd = dist[i] + 1;
    if (x > 0 && nd < dist[i - 1]) { dist[i - 1] = nd; q[tail++] = i - 1; }
    if (x + 1 < width && nd < dist[i + 1]) { dist[i + 1] = nd; q[tail++] = i + 1; }
    if (y > 0 && nd < dist[i - width]) { dist[i - width] = nd; q[tail++] = i - width; }
    if (y + 1 < height && nd < dist[i + width]) { dist[i + width] = nd; q[tail++] = i + width; }
  }
  for (let i = 0; i < dist.length; i++) if (!mask[i]) dist[i] = -dist[i];
  return dist;
}

function bilinear(values: Float32Array, width: number, height: number, nx: number, ny: number) {
  const x = clamp(nx) * (width - 1), y = clamp(ny) * (height - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0, ty = y - y0;
  const a = mix(values[y0 * width + x0], values[y0 * width + x1], tx);
  const b = mix(values[y1 * width + x0], values[y1 * width + x1], tx);
  return mix(a, b, ty);
}

function chooseThreshold(scores: Float32Array, targetShare: number) {
  let lo = Infinity, hi = -Infinity;
  for (const v of scores) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const target = clamp(targetShare);
  for (let iter = 0; iter < 18; iter++) {
    const mid = (lo + hi) * 0.5;
    let land = 0;
    for (const v of scores) if (v >= mid) land++;
    if (land / scores.length > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) * 0.5;
}

function buildWorldMask(seed: number, world: WorldSettings, width: number, height: number) {
  const coarse = growContinents(seed, world);
  const signed = signedDistance(coarse.mask, coarse.width, coarse.height);
  const scores = new Float32Array(width * height);
  const coast = clamp(world.coastComplexity / 100);

  for (let y = 0; y < height; y++) {
    const ny = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const nx = x / Math.max(1, width - 1);
      const base = bilinear(signed, coarse.width, coarse.height, nx, ny) / 3.2;
      const legacy = worldLegacyNoise(nx, ny, seed + 9000);
      const regional = gradientNoise(nx * 10, ny * 6.25, seed + 9100, 10);
      const edge = Math.min(nx, 1 - nx);
      const edgePenalty = clamp((0.075 - edge) / 0.075) * 5;
      scores[y * width + x] = base + legacy * (0.82 + coast * 0.92) + regional * 0.30 - edgePenalty;
    }
  }

  const threshold = chooseThreshold(scores, world.landTarget / 100);
  const mask = new Uint8Array(scores.length);
  for (let i = 0; i < scores.length; i++) mask[i] = scores[i] >= threshold ? 1 : 0;
  return mask;
}

function analyzeMask(mask: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const sizes: number[] = [];
  let total = 0;
  for (const v of mask) if (v) total++;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!mask[start] || seen[start]) continue;
      let top = 0, size = 0;
      stack[top++] = start; seen[start] = 1;
      while (top) {
        const i = stack[--top]; size++;
        const cx = i % width, cy = Math.floor(i / width);
        if (cx > 0) { const j = i - 1; if (mask[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; } }
        if (cx + 1 < width) { const j = i + 1; if (mask[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; } }
        if (cy > 0) { const j = i - width; if (mask[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; } }
        if (cy + 1 < height) { const j = i + width; if (mask[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; } }
      }
      sizes.push(size);
    }
  }
  sizes.sort((a, b) => b - a);
  const major = sizes.filter(v => v >= total * 0.02);
  const small = sizes.filter(v => v < total * 0.02).reduce((a, b) => a + b, 0);
  let edgeLand = 0;
  for (let y = 0; y < height; y++) edgeLand += mask[y * width] + mask[y * width + width - 1];
  return {
    landShare: total / mask.length,
    major: major.length,
    largest: total ? (sizes[0] ?? 0) / total : 0,
    second: total ? (sizes[1] ?? 0) / total : 0,
    small: total ? small / total : 0,
    edge: edgeLand / Math.max(1, height * 2),
  };
}

function scoreWorld(mask: Uint8Array, width: number, height: number, world: WorldSettings) {
  const m = analyzeMask(mask, width, height);
  const targetLand = world.landTarget / 100;
  const targetN = world.continentCount;
  let score = Math.abs(m.landShare - targetLand) * 160;
  score += Math.abs(m.major - targetN) * 7;
  score += Math.max(0, m.largest - 0.55) * 55;
  score += Math.max(0, 0.22 - m.largest) * 25;
  score += Math.max(0, 0.10 - m.second) * 45;
  score += m.small * 25;
  score += m.edge * 100;
  return score;
}

function chooseWorldCandidate(seed: number, world: WorldSettings) {
  const count = Math.max(4, Math.min(16, Math.round(world.candidates)));
  let bestSeed = seed;
  let bestIndex = 0;
  let bestScore = Infinity;
  const previewWidth = 160, previewHeight = 100;
  for (let i = 0; i < count; i++) {
    const candidateSeed = (seed + i * 7919) % 1000000;
    const mask = buildWorldMask(candidateSeed, world, previewWidth, previewHeight);
    const score = scoreWorld(mask, previewWidth, previewHeight, world);
    if (score < bestScore) { bestScore = score; bestSeed = candidateSeed; bestIndex = i; }
  }
  return {seed: bestSeed, index: bestIndex, score: bestScore};
}

function distancesFromCoast(mask: Uint8Array, width: number, height: number) {
  const dist = new Float32Array(mask.length);
  dist.fill(1e9);
  const q = new Int32Array(mask.length);
  let head = 0, tail = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = mask[i];
      let boundary = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (!boundary && (mask[i - 1] !== v || mask[i + 1] !== v || mask[i - width] !== v || mask[i + width] !== v)) boundary = true;
      if (boundary) { dist[i] = 0; q[tail++] = i; }
    }
  }
  while (head < tail) {
    const i = q[head++];
    const x = i % width, y = Math.floor(i / width), nd = dist[i] + 1;
    if (x > 0 && nd < dist[i - 1]) { dist[i - 1] = nd; q[tail++] = i - 1; }
    if (x + 1 < width && nd < dist[i + 1]) { dist[i + 1] = nd; q[tail++] = i + 1; }
    if (y > 0 && nd < dist[i - width]) { dist[i - width] = nd; q[tail++] = i - width; }
    if (y + 1 < height && nd < dist[i + width]) { dist[i + width] = nd; q[tail++] = i + width; }
  }
  return dist;
}

function finalizeField(values: Float32Array, width: number, height: number, sea: number, meta: Partial<HeightField> = {}): HeightField {
  let min = 1, max = 0, sum = 0, land = 0;
  const histogram = Array(24).fill(0);
  for (const elevation of values) {
    min = Math.min(min, elevation); max = Math.max(max, elevation); sum += elevation;
    if (elevation >= sea) land++;
    histogram[Math.min(23, Math.floor(clamp(elevation) * 24))]++;
  }
  const peak = Math.max(...histogram);
  return {
    values, width, height, min, max, mean: sum / values.length,
    land: Math.round(land / values.length * 100),
    histogram: histogram.map(v => v / Math.max(1, peak)),
    seamShift: 0,
    ...meta,
  };
}

export function generateLegacy(seed: number, s: HeightSettings, width = W, height = H): HeightField {
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const ny = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const nx = x / Math.max(1, width - 1);
      const raw = 0.5 + fractalNoise(nx, ny, seed, s) * 0.5;
      values[y * width + x] = clamp(Math.pow(clamp(raw), s.redistribution));
    }
  }
  return finalizeField(values, width, height, s.sea);
}

export function generateWorld(seed: number, s: HeightSettings, world: WorldSettings, width = W, height = H): HeightField {
  const chosen = chooseWorldCandidate(seed, world);
  const mask = buildWorldMask(chosen.seed, world, width, height);
  const coastDistance = distancesFromCoast(mask, width, height);
  const values = new Float32Array(width * height);
  const minDim = Math.max(1, Math.min(width, height));

  for (let y = 0; y < height; y++) {
    const ny = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const nx = x / Math.max(1, width - 1);
      const i = y * width + x;
      const d = coastDistance[i] / minDim;
      if (mask[i]) {
        const legacy = worldLegacyNoise(nx, ny, chosen.seed + 12000);
        const regional = gradientNoise(nx * 7, ny * 4.4, chosen.seed + 13000, 7) * 0.65 + gradientNoise(nx * 13, ny * 8.1, chosen.seed + 14000, 13) * 0.35;
        const basin = gradientNoise(nx * 3.5, ny * 2.2, chosen.seed + 17000, 4);
        const uplift = Math.min(d * 0.75, 0.115);
        const relative = Math.max(0.006, 0.028 + uplift + legacy * 0.15 + regional * 0.075 + basin * 0.045);
        values[i] = clamp(s.sea + relative);
      } else {
        const basin = gradientNoise(nx * 2.5, ny * 1.55, chosen.seed + 15000, 3) * 0.72 + gradientNoise(nx * 5, ny * 3.1, chosen.seed + 16000, 5) * 0.28;
        const depth = Math.min(d * 1.18, 0.23);
        const relative = Math.max(0.006, 0.020 + depth - basin * 0.035);
        values[i] = clamp(s.sea - relative);
      }
    }
  }

  return finalizeField(values, width, height, s.sea, {
    candidateIndex: chosen.index,
    candidateSeed: chosen.seed,
    candidateScore: chosen.score,
  });
}

export function generate(
  seed: number,
  s: HeightSettings,
  mode: GeneratorMode = "legacy",
  world: WorldSettings = {landTarget: 35, continentCount: 4, coastComplexity: 55, candidates: 10},
  width = W,
  height = H,
): HeightField {
  return mode === "world" ? generateWorld(seed, s, world, width, height) : generateLegacy(seed, s, width, height);
}
