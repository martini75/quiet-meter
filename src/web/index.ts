/**
 * Browser capture, via the Web Audio API.
 *
 * The browser hands us raw PCM, so this adapter feeds `pushFrame` and the core computes the
 * levels itself — the more trustworthy of the two input paths.
 *
 * The important work here is not reading samples. It is **switching off the processing that
 * browsers apply by default**. Echo cancellation, noise suppression and automatic gain control
 * exist to make voice calls pleasant, and all three destroy a measurement: AGC in particular
 * amplifies quiet passages toward the mean, which turns a silent room into an average one.
 *
 * Browsers may ignore those constraints. So the adapter asks, then checks what it actually
 * got, and marks the reading as suspect when the answer is wrong. That flag reaches the
 * provenance and widens nothing silently.
 */

import { QuietMeasurement, type Calibration, type DeviceInfo, type QuietReading } from "../core";

export interface WebCaptureOptions {
  /** Supply to obtain dB SPL. Omit and the reading stays device-relative. */
  calibration?: Calibration;
  /** How often to take a level sample. 100 ms is the usual "fast" time weighting. */
  intervalMs?: number;
  /** Passed to getUserMedia when you need a specific input. */
  deviceId?: string;
  /** Called on every sample, for a live readout. */
  onLevel?: (dbfs: number) => void;
}

export interface WebCaptureSession {
  /** Stop capture, release the microphone, and return the reading. */
  stop(): Promise<QuietReading>;
  /** Reading so far, without stopping. */
  peek(): QuietReading;
  /** True while the microphone is open. */
  readonly active: boolean;
}

/** Constraints that ask the browser to stay out of the way. */
function rawAudioConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

function detectDevice(track: MediaStreamTrack): DeviceInfo {
  const settings = track.getSettings() as MediaTrackSettings & {
    autoGainControl?: boolean;
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
  };

  // Undefined means the browser did not report it, which we treat as "cannot confirm it is
  // off" rather than "it is off" — the pessimistic reading is the honest one.
  const agcSuspected =
    settings.autoGainControl !== false ||
    settings.noiseSuppression !== false ||
    settings.echoCancellation !== false;

  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return {
    platform: "web",
    model: track.label || undefined,
    os: ua || undefined,
    agcSuspected,
  };
}

/**
 * Open the microphone and start measuring. Resolves once capture is running.
 *
 * @throws if the browser has no microphone permission, or no Web Audio support.
 */
export async function startWebCapture(options: WebCaptureOptions = {}): Promise<WebCaptureSession> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("quiet-meter/web: this browser has no microphone access (getUserMedia).");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: rawAudioConstraints(options.deviceId),
    video: false,
  });

  const track = stream.getAudioTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("quiet-meter/web: the microphone stream carried no audio track.");
  }

  const AudioCtor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("quiet-meter/web: this browser has no Web Audio API.");
  }

  const context = new AudioCtor();
  // Autoplay policies can start the context suspended even for capture.
  if (context.state === "suspended") await context.resume();

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  // 2048 at 48 kHz is ~43 ms of audio: long enough to be stable, short enough that a passing
  // car still shows up as a distinct event in L10 rather than being smeared into the mean.
  analyser.fftSize = 2048;
  // No smoothing: we want the real frame, and the statistics do the averaging.
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  const measurement = new QuietMeasurement({
    device: detectDevice(track),
    calibration: options.calibration,
  });

  const buffer = new Float32Array(analyser.fftSize);
  const intervalMs = options.intervalMs ?? 100;
  let active = true;

  const timer = setInterval(() => {
    if (!active) return;
    analyser.getFloatTimeDomainData(buffer);
    const level = measurement.pushFrame(buffer, context.sampleRate);
    options.onLevel?.(level);
  }, intervalMs);

  const release = async () => {
    active = false;
    clearInterval(timer);
    try {
      source.disconnect();
    } catch {
      /* already torn down */
    }
    stream.getTracks().forEach((t) => t.stop());
    if (context.state !== "closed") await context.close();
  };

  return {
    get active() {
      return active;
    },
    peek: () => measurement.result(),
    stop: async () => {
      const reading = measurement.result();
      await release();
      return reading;
    },
  };
}
