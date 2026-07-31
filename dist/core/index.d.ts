/**
 * quiet-meter — measure how quiet a place is, honestly.
 *
 * Platform-free core. Import `quiet-meter/web` or `quiet-meter/expo` for a capture adapter.
 */
export { rms, amplitudeToDbfs, frameDbfs, aWeightingDb, spectrumDbfsA, FLOOR_DBFS } from "./signal";
export { exceedance, leq, summarise, type LevelStats } from "./stats";
export { buildProvenance, MIN_REPRESENTATIVE_MS, type Calibration, type CalibrationSource, type DeviceInfo, type Provenance, } from "./provenance";
export { scoreFromBackground, describeScore, type QuietScore } from "./score";
export { QuietMeasurement, LIBRARY_ID, type QuietReading, type MeasurementOptions } from "./measurement";
//# sourceMappingURL=index.d.ts.map