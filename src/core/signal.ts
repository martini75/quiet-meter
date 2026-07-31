/**
 * Signal maths. Pure functions, no platform APIs, no dependencies.
 *
 * Everything here works in **dBFS** — decibels relative to digital full scale — which is
 * always <= 0 and is a property of the recording chain, not of the room. Converting dBFS to
 * dB SPL (what a sound level meter reads) requires a per-device offset that can only come
 * from calibration. See `provenance.ts` for why that distinction is enforced rather than
 * quietly papered over.
 */

/** Anything quieter than this is treated as digital silence, to keep log10 finite. */
export const FLOOR_DBFS = -100;

/** Root mean square amplitude of a frame of normalised (-1..1) samples. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/** Convert an RMS amplitude (0..1) to dBFS, clamped at the floor. */
export function amplitudeToDbfs(amplitude: number): number {
  if (amplitude <= 0) return FLOOR_DBFS;
  const db = 20 * Math.log10(amplitude);
  return db < FLOOR_DBFS ? FLOOR_DBFS : db;
}

/** RMS level of a frame, in dBFS. */
export function frameDbfs(samples: Float32Array): number {
  return amplitudeToDbfs(rms(samples));
}

/**
 * A-weighting gain at a given frequency, in dB (IEC 61672-1).
 *
 * A-weighting approximates how the ear discounts low and very high frequencies. It matters
 * here because a room dominated by distant traffic rumble measures loud unweighted but is
 * experienced as quiet — and the opposite for a dripping tap.
 */
export function aWeightingDb(frequencyHz: number): number {
  if (frequencyHz <= 0) return FLOOR_DBFS;
  const f2 = frequencyHz * frequencyHz;
  const f4 = f2 * f2;
  const numerator = 12194 * 12194 * f4;
  const denominator =
    (f2 + 20.6 * 20.6) *
    Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) *
    (f2 + 12194 * 12194);
  // +2.00 dB normalises the response to 0 dB at 1 kHz, as the standard defines it.
  return 20 * Math.log10(numerator / denominator) + 2.0;
}

/**
 * A-weighted level of a magnitude spectrum, in dBFS.
 *
 * `magnitudes[i]` is the linear magnitude of bin i; bin i is centred at
 * `i * sampleRate / fftSize` Hz.
 */
export function spectrumDbfsA(
  magnitudes: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
): number {
  let power = 0;
  const binHz = sampleRate / fftSize;
  for (let i = 1; i < magnitudes.length; i++) {
    const gain = 10 ** (aWeightingDb(i * binHz) / 20);
    const weighted = magnitudes[i] * gain;
    power += weighted * weighted;
  }
  return amplitudeToDbfs(Math.sqrt(power));
}
