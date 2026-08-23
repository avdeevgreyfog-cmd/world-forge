import {H,W,type HeightField} from "./core.ts";

export type LandmassAnalysis = {
  components: number;
  majorLandmasses: number;
  largestShare: number;
  secondShare: number;
  smallIslandsShare: number;
  componentSizes: number[];
};

export function analyzeLandmasses(
  field: Pick<HeightField,"values"> & Partial<Pick<HeightField,"width"|"height">>,
  sea: number,
  majorShareThreshold = 0.02,
): LandmassAnalysis {
  const width = field.width ?? W;
  const height = field.height ?? H;
  const visited = new Uint8Array(width * height);
  const sizes: number[] = [];
  let totalLand = 0;

  for (let i = 0; i < field.values.length; i++) {
    if (field.values[i] >= sea) totalLand++;
  }

  if (totalLand === 0) {
    return {
      components: 0,
      majorLandmasses: 0,
      largestShare: 0,
      secondShare: 0,
      smallIslandsShare: 0,
      componentSizes: [],
    };
  }

  const stack: number[] = [];
  const pushIfLand = (x: number, y: number) => {
    if (y < 0 || y >= height) return;
    const wrappedX = ((x % width) + width) % width;
    const index = y * width + wrappedX;
    if (visited[index] || field.values[index] < sea) return;
    visited[index] = 1;
    stack.push(index);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (visited[start] || field.values[start] < sea) continue;

      let size = 0;
      visited[start] = 1;
      stack.push(start);

      while (stack.length) {
        const index = stack.pop()!;
        size++;
        const cx = index % width;
        const cy = Math.floor(index / width);
        pushIfLand(cx - 1, cy);
        pushIfLand(cx + 1, cy);
        pushIfLand(cx, cy - 1);
        pushIfLand(cx, cy + 1);
      }

      sizes.push(size);
    }
  }

  sizes.sort((a, b) => b - a);
  const thresholdPixels = totalLand * majorShareThreshold;
  const major = sizes.filter((size) => size >= thresholdPixels);
  const smallArea = sizes
    .filter((size) => size < thresholdPixels)
    .reduce((sum, size) => sum + size, 0);

  return {
    components: sizes.length,
    majorLandmasses: major.length,
    largestShare: (sizes[0] ?? 0) / totalLand,
    secondShare: (sizes[1] ?? 0) / totalLand,
    smallIslandsShare: smallArea / totalLand,
    componentSizes: sizes,
  };
}
