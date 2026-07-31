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
export declare const FLOOR_DBFS = -100;
/** Root mean square amplitude of a frame of normalised (-1..1) samples. */
export declare function rms(samples: Float32Array): number;
/** Convert an RMS amplitude (0..1) to dBFS, clamped at the floor. */
export declare function amplitudeToDbfs(amplitude: number): number;
/** RMS level of a frame, in dBFS. */
export declare function frameDbfs(samples: Float32Array): number;
/**
 * A-weighting gain at a given frequency, in dB (IEC 61672-1).
 *
 * A-weighting approximates how the ear discounts low and very high frequencies. It matters
 * here because a room dominated by distant traffic rumble measures loud unweighted but is
 * experienced as quiet — and the opposite for a dripping tap.
 */
export declare function aWeightingDb(frequencyHz: number): number;
/**
 * A-weighted level of a magnitude spectrum, in dBFS.
 *
 * `magnitudes[i]` is the linear magnitude of bin i; bin i is centred at
 * `i * sampleRate / fftSize` Hz.
 */
export declare function spectrumDbfsA(magnitudes: ArrayLike<number>, sampleRate: number, fftSize: number): number;
//# sourceMappingURL=signal.d.ts.map