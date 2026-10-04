import type { ThemeId } from '../themes/types';

const SAMPLE_CAPACITY = 3_600;
const FRAME_BUDGET_MS = 1_000 / 60;

export interface BenchmarkMetadata {
  theme: ThemeId;
  width: number;
  height: number;
  pixelRatio: number;
  renderer: string;
  wave: number;
  tick: number;
}

export interface BenchmarkSnapshot extends BenchmarkMetadata {
  seed: number;
  measurement: 'visible-render-frame-interval';
  targetHz: number;
  totalFrames: number;
  elapsedMs: number;
  estimatedDroppedFrames: number;
  sampleCount: number;
  sampleWindowMs: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface Benchmark {
  sample(deltaMs: number): void;
  snapshot(metadata: BenchmarkMetadata): BenchmarkSnapshot;
  reset(): void;
}

export function createBenchmark(seed: number): Benchmark {
  const samples = new Float64Array(SAMPLE_CAPACITY);
  const sortedSamples = new Float64Array(SAMPLE_CAPACITY);
  let cursor = 0;
  let sampleCount = 0;
  let sampleWindowMs = 0;
  let totalFrames = 0;
  let elapsedMs = 0;
  let estimatedDroppedFrames = 0;

  function percentile(sorted: Float64Array, fraction: number): number {
    if (sorted.length === 0) return 0;
    const position = (sorted.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const lowValue = sorted[lower] ?? 0;
    const highValue = sorted[upper] ?? lowValue;
    return lowValue + (highValue - lowValue) * (position - lower);
  }

  return {
    sample(deltaMs) {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
      if (sampleCount === SAMPLE_CAPACITY) {
        sampleWindowMs -= samples[cursor] ?? 0;
      } else {
        sampleCount += 1;
      }
      samples[cursor] = deltaMs;
      sampleWindowMs += deltaMs;
      cursor = (cursor + 1) % SAMPLE_CAPACITY;
      totalFrames += 1;
      elapsedMs += deltaMs;
      estimatedDroppedFrames += Math.max(0, Math.round(deltaMs / FRAME_BUDGET_MS) - 1);
    },
    snapshot(metadata) {
      sortedSamples.set(samples);
      const sorted = sortedSamples.subarray(0, sampleCount);
      sorted.sort();
      return {
        ...metadata,
        seed,
        measurement: 'visible-render-frame-interval',
        targetHz: 60,
        totalFrames,
        elapsedMs,
        estimatedDroppedFrames,
        sampleCount,
        sampleWindowMs,
        averageMs: sampleCount === 0 ? 0 : sampleWindowMs / sampleCount,
        p50Ms: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        p99Ms: percentile(sorted, 0.99),
        maxMs: sorted[sampleCount - 1] ?? 0,
      };
    },
    reset() {
      cursor = 0;
      sampleCount = 0;
      sampleWindowMs = 0;
      totalFrames = 0;
      elapsedMs = 0;
      estimatedDroppedFrames = 0;
    },
  };
}
