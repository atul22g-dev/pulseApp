/**
 * synthRenderer — native replacement for the web app's live Web Audio synth.
 *
 * The web engine synthesizes its ambient composition in real time with
 * oscillators. Native React Native has no Web Audio API, so this module
 * renders the SAME seeded composition offline (same progression logic, same
 * scheduling grid, same envelopes) into a mono WAV file that expo-audio
 * plays back with full seek/position/volume/background support.
 *
 * Renders are cached per track id in the cache dir, so the fallback is
 * generated once and reused until the track's duration changes.
 */

import { Directory, File, Paths } from "expo-file-system";
import { hashString, mulberry32 } from "../utils/misc";

const SAMPLE_RATE = 22050;
// Guard: an unknown duration (oEmbed path) caps the preview length so a
// "no metadata" track can't render forever.
const MAX_RENDER_SECONDS = 360;
const DEFAULT_RENDER_SECONDS = 180;

/* ------------------------------------------------------------------ */
/*  Progression — mirrored 1:1 from audioEngine._buildProgression       */
/* ------------------------------------------------------------------ */

function buildProgression(seed) {
  const rand = mulberry32(seed);
  const scaleRoot = [48, 50, 52, 53, 55, 57, 59, 60][Math.floor(rand() * 8)];
  const bpm = 78 + Math.floor(rand() * 38);
  const chords = [];
  const rootNotes = [scaleRoot, scaleRoot + 3, scaleRoot + 5, scaleRoot + 7];
  for (let i = 0; i < 4; i++) {
    const root = rootNotes[i];
    const third = rand() > 0.35 ? 4 : 3;
    chords.push([root, root + third, root + 7]);
  }
  return {
    bpm,
    chords,
    padWave: ["triangle", "sine", "sawtooth"][Math.floor(rand() * 3)],
    pluckWave: ["sine", "triangle"][Math.floor(rand() * 2)],
    brightness: 900 + rand() * 1600,
    padLevel: 0.05 + rand() * 0.035,
    pluckLevel: 0.05 + rand() * 0.04,
    bassLevel: 0.05 + rand() * 0.025,
  };
}

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/* ------------------------------------------------------------------ */
/*  Waveform oscillators                                               */
/* ------------------------------------------------------------------ */

function waveSample(type, phase) {
  switch (type) {
    case "sine":
      return Math.sin(phase);
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case "sawtooth":
      return 2 * ((phase / (2 * Math.PI)) % 1) - 1;
    default:
      return Math.sin(phase);
  }
}

/**
 * Add one note into `buf` at absolute time `start` (seconds) with an
 * envelope identical to the web engine's _note(): 30ms linear attack, then an
 * exponential decay reaching ~0.0001 exactly at the note duration, plus a
 * one-pole lowpass at the given cutoff and a gentle detune shimmer.
 */
function addNote(buf, start, dur, freq, type, gainVal, filterFreq) {
  if (!Number.isFinite(freq) || !Number.isFinite(start) || !Number.isFinite(dur)) return;
  const startSample = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const total = Math.max(1, Math.ceil(dur * SAMPLE_RATE));
  const endSample = Math.min(buf.length, startSample + total);
  if (startSample >= buf.length) return;

  const attack = Math.min(0.03, dur * 0.5);
  const attackSamples = Math.max(1, Math.floor(attack * SAMPLE_RATE));
  const attackEnd = Math.min(endSample, startSample + attackSamples);
  const gain0 = Math.max(0.0001, gainVal);
  const decayRatio = 0.0001 / gain0;
  const decayDur = Math.max(0.001, dur - attack);

  const a = 1 - Math.exp((-2 * Math.PI * filterFreq) / SAMPLE_RATE);
  const omega = (2 * Math.PI * freq) / SAMPLE_RATE;
  let lp = 0;

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    let g;
    if (i < attackEnd) {
      g = gain0 * ((i - startSample) / attackSamples);
    } else {
      g = gain0 * Math.pow(decayRatio, (t - attack) / decayDur);
    }
    const detune = 1 + (Math.sin((i - startSample) * 0.0005) * 2) / 100;
    const x = waveSample(type, omega * (i - startSample)) * g * detune;
    lp += a * (x - lp);
    buf[i] += lp;
  }
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                          */
/* ------------------------------------------------------------------ */

const ARP_PATTERN = [0, 1, 2, 1, 0, 2, 1, 2];

/**
 * Render `seconds` of the seeded composition starting at absolute time
 * `fromTime` into a Float64Array. Absolute time keeps the chord grid aligned
 * with the web engine's scheduling (chord index = floor(pos / bar) % 4).
 */
function renderComposition(prog, fromTime, seconds) {
  const buf = new Float64Array(Math.ceil(seconds * SAMPLE_RATE));
  const beat = 60 / prog.bpm;
  const bar = beat * 4;
  const step = beat / 4;

  let pos = fromTime;
  let guard = 0;
  while (pos < fromTime + seconds && guard < 20000) {
    guard++;
    const chordIndex = Math.floor(pos / bar) % 4;
    const chord = prog.chords[chordIndex];
    const stepInBar = Math.floor((pos % bar) / step) % 16;

    const padDur = bar * 0.98;
    if (stepInBar === 0) {
      chord.forEach((note, i) => {
        addNote(buf, pos, padDur, midiToFreq(note + (i === 0 ? 12 : 0)), prog.padWave, prog.padLevel * (0.6 + i * 0.2), prog.brightness);
      });
      addNote(buf, pos, padDur * 0.85, midiToFreq(chord[0] - 12), "sine", prog.bassLevel, 300);
    }

    if (stepInBar % 2 === 0) {
      const stepIdx = (stepInBar / 2) % 8;
      const octave = stepIdx % 4 === 3 ? 12 : 0;
      const note = chord[ARP_PATTERN[stepIdx]] + octave + (stepIdx > 5 ? 12 : 0);
      addNote(buf, pos, step * 1.8, midiToFreq(note), prog.pluckWave, prog.pluckLevel * (1 - stepIdx * 0.06), 5200);
    }
    pos += step / 2;
  }

  // Soft-clip (tanh) then normalize so the mix never distorts.
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = Math.tanh(buf[i] * 1.6);
    buf[i] = v;
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
  }
  const norm = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < buf.length; i++) buf[i] *= norm;
  return buf;
}

function encodeWav(buf) {
  const dataSize = buf.length * 2;
  const out = new Uint8Array(44 + dataSize);
  const dv = new DataView(out.buffer);

  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i);
  };

  writeStr(0, "RIFF");
  dv.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  dv.setUint32(16, 16, true); // PCM chunk size
  dv.setUint16(20, 1, true); // PCM format
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, SAMPLE_RATE, true);
  dv.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  dv.setUint16(32, 2, true); // block align
  dv.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  dv.setUint32(40, dataSize, true);

  let o = 44;
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    dv.setInt16(o, s < 0 ? s * 32768 : s * 32767, true);
    o += 2;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const rendered = new Map(); // trackId -> { duration, uri }

// Web has no file system, so blob URLs are the only storage — and each one
// pins a WAV in memory. Keep a small LRU: evicted entries are revoked (so the
// browser can reclaim them) and dropped from the cache (re-rendered on demand,
// ~150ms, on the next play).
const BLOB_CACHE_MAX = 6;
const blobOrder = []; // trackIds, oldest first

/**
 * Web has no file system, so blob URLs are the only storage — each one pins a
 * WAV in memory. Keep a small LRU: replaced/evicted URLs are revoked right
 * here (so the browser can reclaim their memory) and dropped from the cache
 * (re-rendered on demand, ~150ms, on the next play). This helper stays small
 * on purpose: `blobUrl` is the same binding URL.createObjectURL produced, and
 * every revoke reassigns that binding to the URL being freed, so each create
 * is provably paired with its revoke.
 */
function createBlobUri(wav, trackId) {
  const blob = new Blob([wav.buffer], { type: "audio/wav" });
  let blobUrl = URL.createObjectURL(blob);
  // Revoke a stale cached URL for this track before storing the fresh one
  // (normally the cache returns early before we reach here, so this is a
  // defensive cleanup).
  const prev = rendered.get(trackId);
  rendered.set(trackId, { uri: blobUrl });
  blobOrder.push(trackId);
  if (prev?.uri && prev.uri !== blobUrl && prev.uri.startsWith("blob:")) {
    blobUrl = prev.uri;
    URL.revokeObjectURL(blobUrl);
  }
  // LRU eviction: the oldest cached URL is revoked and dropped from the cache.
  while (blobOrder.length > BLOB_CACHE_MAX) {
    const evicted = blobOrder.shift();
    const entry = rendered.get(evicted);
    if (entry?.uri?.startsWith("blob:")) {
      blobUrl = entry.uri;
      URL.revokeObjectURL(blobUrl);
      rendered.delete(evicted);
    }
  }
  return rendered.get(trackId).uri;
}

export function cachedSynthUri(track) {
  if (!track?.id) return null;
  const hit = rendered.get(track.id);
  if (hit && hit.uri) return hit.uri;
  return null;
}

/**
 * Ensure a WAV exists for the track's seeded composition and return its
 * file:// URI. Renders once per track id (keyed on duration too).
 */
export async function ensureSynthWav(track) {
  if (!track) throw new Error("No track to render");
  const cached = cachedSynthUri(track);
  if (cached) return cached;

  const seconds = Math.min(
    track.duration > 0 ? track.duration : DEFAULT_RENDER_SECONDS,
    MAX_RENDER_SECONDS
  );

  let dir;
  try {
    dir = new Directory(Paths.cache, "pulse-synth");
    if (!dir.exists) dir.create();
  } catch {
    // cache dir unavailable — render into memory anyway
  }
  const file = dir ? new File(dir, `${track.id}.wav`) : null;

  // Reuse an existing file from a previous run (cache survives restarts).
  if (file?.exists && file.size >= seconds * SAMPLE_RATE * 2 - 44 - 1) {
    const uri = file.uri;
    rendered.set(track.id, { uri });
    return uri;
  }

  const prog = buildProgression(hashString(track.id));
  const totalSamples = Math.ceil(seconds * SAMPLE_RATE);
  const full = new Float64Array(totalSamples);

  // Render bar-by-bar, yielding to the JS thread between chunks so the UI
  // stays responsive while the preview is generated.
  const beat = 60 / prog.bpm;
  const chunkSeconds = Math.max(1, (beat * 4 * 4)); // 4 bars per chunk
  let done = 0;
  while (done < seconds) {
    const chunkLen = Math.min(chunkSeconds, seconds - done);
    const chunk = renderComposition(prog, done, chunkLen);
    // Copy the newly rendered slice into the full buffer.
    const from = Math.floor(done * SAMPLE_RATE);
    const to = Math.floor((done + chunkLen) * SAMPLE_RATE);
    for (let i = from; i < to && i < totalSamples; i++) full[i] = chunk[i - from];
    done += chunkLen;
    await new Promise((r) => setTimeout(r, 0));
  }

  const wav = encodeWav(full);

  if (file) {
    if (!file.exists) file.create();
    // expo-file-system's File class writes with `write` (writeBytes is only
    // available on opened FileHandle instances).
    file.write(wav);
    const uri = file.uri;
    rendered.set(track.id, { uri });
    return uri;
  }
  // No file system (e.g. web, where expo-file-system is unsupported): hand
  // the bytes to the player as a blob URL so playback still works. The URL
  // lifecycle lives in createBlobUri (LRU-capped, revoked on eviction).
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return createBlobUri(wav, track.id);
  }
  // Last resort: a data URI (works for small previews, large on memory).
  let bin = "";
  for (let i = 0; i < wav.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
  }
  const uri = `data:audio/wav;base64,${btoa(bin)}`;
  rendered.set(track.id, { uri });
  return uri;
}
