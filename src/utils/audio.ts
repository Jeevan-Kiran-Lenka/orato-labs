export interface ProcessedAudio {
  base64: string;
  mimeType: string;
  previewUrl: string;
  rawDurationSec: number;
  trimmedDurationSec: number;
  trimmedSilenceSec: number;
  bytes: number;
  estimatedRawAudioTokens: number;
  estimatedTrimmedAudioTokens: number;
  peaks: number[];
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWav16kMono(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function computePeaks(samples: Float32Array, buckets = 64): number[] {
  if (samples.length === 0) return Array(buckets).fill(0);
  const step = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = i * step;
    const end = Math.min(samples.length, start + step);
    let maxVal = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(samples[j]);
      if (v > maxVal) maxVal = v;
    }
    peaks.push(maxVal);
  }
  return peaks;
}

function trimSilenceSamples(samples: Float32Array, sampleRate = 16000): Float32Array {
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frame
  const threshold = 0.012;
  const padSamples = Math.floor(sampleRate * 0.14); // 140ms safety pad

  let firstActive = -1;
  let lastActive = -1;

  for (let i = 0; i < samples.length; i += frameSize) {
    const end = Math.min(samples.length, i + frameSize);
    let sumSq = 0;
    for (let j = i; j < end; j++) {
      sumSq += samples[j] * samples[j];
    }
    const rms = Math.sqrt(sumSq / (end - i));
    if (rms >= threshold) {
      if (firstActive === -1) firstActive = i;
      lastActive = end;
    }
  }

  if (firstActive === -1 || lastActive <= firstActive) {
    return samples;
  }

  const startIdx = Math.max(0, firstActive - padSamples);
  const endIdx = Math.min(samples.length, lastActive + padSamples);
  return samples.slice(startIdx, endIdx);
}

export async function processAudioBlob(
  blob: Blob,
  options: { trimSilence: boolean }
): Promise<ProcessedAudio> {
  const arrayBuffer = await blob.arrayBuffer();
  const decodeCtx = new AudioContext();
  try {
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
    const rawDurationSec = decoded.duration;

    // Resample to 16kHz mono via OfflineAudioContext
    const targetRate = 16000;
    const targetLength = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, targetLength, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    const monoSamples = rendered.getChannelData(0);

    const finalSamples = options.trimSilence
      ? trimSilenceSamples(monoSamples, targetRate)
      : monoSamples;

    const trimmedDurationSec = finalSamples.length / targetRate;
    const trimmedSilenceSec = Math.max(0, rawDurationSec - trimmedDurationSec);

    const wavBuffer = encodeWav16kMono(finalSamples, targetRate);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const previewUrl = URL.createObjectURL(wavBlob);
    const base64 = arrayBufferToBase64(wavBuffer);

    return {
      base64,
      mimeType: 'audio/wav',
      previewUrl,
      rawDurationSec,
      trimmedDurationSec,
      trimmedSilenceSec,
      bytes: wavBuffer.byteLength,
      estimatedRawAudioTokens: Math.round(rawDurationSec * 25),
      estimatedTrimmedAudioTokens: Math.round(trimmedDurationSec * 25),
      peaks: computePeaks(finalSamples, 64),
    };
  } finally {
    await decodeCtx.close();
  }
}
