/**
 * quiet-meter — measure how quiet a place is, honestly.
 *
 * Platform-free core. Import `quiet-meter/web` or `quiet-meter/expo` for a capture adapter.
 */
export { rms, amplitudeToDbfs, frameDbfs, aWeightingDb, spectrumDbfsA, FLOOR_DBFS } from "./signal";
export { exceedance, leq, summarise } from "./stats";
export { buildProvenance, MIN_REPRESENTATIVE_MS, } from "./provenance";
export { scoreFromBackground, describeScore } from "./score";
export { QuietMeasurement, LIBRARY_ID } from "./measurement";
