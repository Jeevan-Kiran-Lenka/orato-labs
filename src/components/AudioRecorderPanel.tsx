import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload, Trash2, Play, Pause, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_ORATO_SCHEMA,
  MINIMAL_ORATO_SCHEMA,
  PREVIEW_LANGUAGES,
  TARGET_LANGUAGES,
  TONE_OPTIONS,
  buildDefaultSystemPrompt,
} from '../lib/models';
import type { OratoMode, RecipientTone } from '../types/benchmark';
import { processAudioBlob, type ProcessedAudio } from '../utils/audio';

interface AudioRecorderPanelProps {
  audio: ProcessedAudio | null;
  trimSilence: boolean;
  onTrimSilenceChange: (next: boolean) => void;
  onAudioCaptured: (rawBlob: Blob, processed: ProcessedAudio) => void;
  onClearAudio: () => void;
  targetLanguage: string;
  onTargetLanguageChange: (val: string) => void;
  previewLanguage: string;
  onPreviewLanguageChange: (val: string) => void;
  mode: OratoMode;
  onModeChange: (val: OratoMode) => void;
  tone: RecipientTone;
  onToneChange: (val: RecipientTone) => void;
  previousOutput: string;
  onPreviousOutputChange: (val: string) => void;
  dictionaryText: string;
  onDictionaryTextChange: (val: string) => void;
  customSystemPrompt: string;
  onCustomSystemPromptChange: (val: string) => void;
  schemaText: string;
  onSchemaTextChange: (val: string) => void;
  schemaError: string | null;
}

export function AudioRecorderPanel({
  audio,
  trimSilence,
  onTrimSilenceChange,
  onAudioCaptured,
  onClearAudio,
  targetLanguage,
  onTargetLanguageChange,
  previewLanguage,
  onPreviewLanguageChange,
  mode,
  onModeChange,
  tone,
  onToneChange,
  previousOutput,
  onPreviousOutputChange,
  dictionaryText,
  onDictionaryTextChange,
  customSystemPrompt,
  onCustomSystemPromptChange,
  schemaText,
  onSchemaTextChange,
  schemaError,
}: AudioRecorderPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [liveLevels, setLiveLevels] = useState<number[]>(Array(40).fill(0.08));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  async function handleStartRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const tickWaveform = () => {
        analyser.getByteFrequencyData(freqData);
        const nextBars: number[] = [];
        for (let i = 0; i < 40; i++) {
          const val = freqData[i % freqData.length] / 255;
          nextBars.push(Math.max(0.08, val));
        }
        setLiveLevels(nextBars);
        animFrameRef.current = requestAnimationFrame(tickWaveform);
      };
      tickWaveform();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});

        const rawBlob = new Blob(chunksRef.current, { type: mimeType });
        setIsProcessing(true);
        try {
          const processed = await processAudioBlob(rawBlob, { trimSilence });
          onAudioCaptured(rawBlob, processed);
        } catch (err) {
          setMicError(err instanceof Error ? err.message : 'Failed to decode recorded audio.');
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setRecordingSec(0);
      const startTs = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingSec((Date.now() - startTs) / 1000);
      }, 100);
    } catch (err) {
      setMicError(
        err instanceof Error
          ? err.message
          : 'Microphone access denied. Check browser permissions or upload an audio file.'
      );
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMicError(null);
    setIsProcessing(true);
    try {
      const processed = await processAudioBlob(file, { trimSilence });
      onAudioCaptured(file, processed);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Could not decode uploaded audio file.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  }

  function togglePlayback() {
    if (!audio?.previewUrl) return;
    if (!playerRef.current) {
      playerRef.current = new Audio(audio.previewUrl);
      playerRef.current.onended = () => setIsPlaying(false);
    } else if (playerRef.current.src !== audio.previewUrl) {
      playerRef.current.src = audio.previewUrl;
    }

    if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      playerRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  const parsedDict = dictionaryText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const defaultPromptPreview = buildDefaultSystemPrompt({
    targetLanguage,
    previewLanguage,
    mode,
    tone,
    previousOutput,
    dictionary: parsedDict,
  });

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            01. Capture Voice Sample & Context
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Speak in Hindi, Hinglish, Tanglish, or upload a test clip. Normalized to 16 kHz mono WAV for cross-provider parity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={trimSilence}
              onChange={(e) => onTrimSilenceChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Client-side VAD silence trim</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording || isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload Audio
          </button>

          {!isRecording ? (
            <button
              type="button"
              onClick={handleStartRecording}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              {audio ? 'Record New Clip' : 'Record Voice'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopRecording}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop ({recordingSec.toFixed(1)}s)
            </button>
          )}
        </div>
      </div>

      {micError && (
        <div className="mt-4 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          {micError}
        </div>
      )}

      {/* Audio Waveform & Token Telemetry Strip */}
      <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-md px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {audio && !isRecording && (
            <button
              type="button"
              onClick={togglePlayback}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 shrink-0 cursor-pointer"
              aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}

          <div className="flex items-center gap-1 h-10 flex-1 overflow-hidden" aria-hidden="true">
            {isRecording
              ? liveLevels.map((lvl, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-red-500 rounded-xs transition-all duration-75"
                    style={{ height: `${Math.round(lvl * 100)}%` }}
                  />
                ))
              : audio
                ? audio.peaks.map((pk, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-slate-700 rounded-xs"
                      style={{ height: `${Math.max(10, Math.round(pk * 100))}%` }}
                    />
                  ))
                : Array.from({ length: 48 }).map((_, idx) => (
                    <div key={idx} className="flex-1 bg-slate-200 rounded-xs h-1.5" />
                  ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 shrink-0">
          {isProcessing ? (
            <span className="font-medium text-slate-800">Decoding & resampling to 16 kHz WAV...</span>
          ) : isRecording ? (
            <span className="font-mono font-medium text-red-700">
              Recording · {recordingSec.toFixed(1)}s · ~{Math.round(recordingSec * 25)} audio tok
            </span>
          ) : audio ? (
            <>
              <span className="font-mono text-slate-900 font-medium">
                {audio.trimmedDurationSec.toFixed(2)}s active
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {(audio.bytes / 1024).toFixed(1)} KB WAV
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-blue-700 font-medium">
                ~{audio.estimatedTrimmedAudioTokens} audio tok
              </span>
              {audio.trimmedSilenceSec > 0.05 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-emerald-700">
                    -{audio.trimmedSilenceSec.toFixed(2)}s silence (-
                    {audio.estimatedRawAudioTokens - audio.estimatedTrimmedAudioTokens} tok saved)
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={onClearAudio}
                className="ml-1 inline-flex items-center gap-1 text-slate-500 hover:text-red-600 cursor-pointer"
                title="Clear audio"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <span>No audio captured yet · Click Record Voice or Upload Audio</span>
          )}
        </div>
      </div>

      {/* Orato Context Parameters */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Target Output Language
          </label>
          <select
            value={targetLanguage}
            onChange={(e) => onTargetLanguageChange(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {TARGET_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Meaning Preview Language
          </label>
          <select
            value={previewLanguage}
            onChange={(e) => onPreviewLanguageChange(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {PREVIEW_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Recipient Tone Preset
          </label>
          <select
            value={tone}
            onChange={(e) => onToneChange(e.target.value as RecipientTone)}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Interaction Mode
          </label>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md h-10">
            <button
              type="button"
              onClick={() => onModeChange('dictate')}
              className={`flex-1 h-8 text-xs font-medium rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'dictate'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dictate
            </button>
            <button
              type="button"
              onClick={() => onModeChange('edit')}
              className={`flex-1 h-8 text-xs font-medium rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'edit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Speak to Edit
            </button>
          </div>
        </div>
      </div>

      {/* Dictionary + Speak-to-Edit Previous Text */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Personal Dictionary (comma-separated names, classes, SKUs)
          </label>
          <input
            type="text"
            value={dictionaryText}
            onChange={(e) => onDictionaryTextChange(e.target.value)}
            placeholder="Chapter 5, Sharma Sir, Orato, CBSE, fee receipt"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {mode === 'edit' ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Previous Inserted Output (to edit by voice, e.g. &quot;make it more polite&quot;)
            </label>
            <input
              type="text"
              value={previousOutput}
              onChange={(e) => onPreviousOutputChange(e.target.value)}
              placeholder="There's no class tomorrow. Send Chapter 5 homework."
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        ) : (
          <div className="flex items-end justify-between pb-1">
            <button
              type="button"
              onClick={() => setShowPromptEditor((prev) => !prev)}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {showPromptEditor ? 'Hide Prompt & Structured Output Schema' : 'Inspect / Tune Prompt & Structured Output Schema'}
            </button>
            <span className="text-xs font-mono text-slate-500">
              {parsedDict.length} dictionary terms
            </span>
          </div>
        )}
      </div>

      {mode === 'edit' && (
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowPromptEditor((prev) => !prev)}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showPromptEditor ? 'Hide Prompt & Structured Output Schema' : 'Inspect / Tune Prompt & Structured Output Schema'}
          </button>
        </div>
      )}

      {showPromptEditor && (
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700">
                System Instruction{' '}
                <span className="font-normal text-slate-500">
                  ({customSystemPrompt ? 'Custom override active' : 'Auto-synced with controls'})
                </span>
              </label>
              {customSystemPrompt && (
                <button
                  type="button"
                  onClick={() => onCustomSystemPromptChange('')}
                  className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  Reset Prompt
                </button>
              )}
            </div>
            <textarea
              rows={10}
              value={customSystemPrompt || defaultPromptPreview}
              onChange={(e) => onCustomSystemPromptChange(e.target.value)}
              className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-xs font-medium text-slate-700">
                Structured Output Schema (Gemini <span className="font-mono">responseSchema</span>)
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onSchemaTextChange(JSON.stringify(DEFAULT_ORATO_SCHEMA, null, 2))}
                  className="font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Default (6 fields)
                </button>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => onSchemaTextChange(JSON.stringify(MINIMAL_ORATO_SCHEMA, null, 2))}
                  className="font-medium text-blue-700 hover:text-blue-800 underline cursor-pointer"
                >
                  Minimal Deck (4 fields)
                </button>
              </div>
            </div>
            <textarea
              rows={10}
              value={schemaText}
              onChange={(e) => onSchemaTextChange(e.target.value)}
              spellCheck={false}
              className={`w-full p-3 text-xs font-mono bg-slate-50 border rounded-md text-slate-800 focus:outline-none focus:ring-2 ${
                schemaError
                  ? 'border-red-400 focus:ring-red-600'
                  : 'border-slate-300 focus:ring-blue-600'
              }`}
            />
            <div className="mt-1.5 text-xs">
              {schemaError ? (
                <span className="text-red-700 font-medium">{schemaError}</span>
              ) : (
                <span className="text-slate-500">
                  Valid JSON schema · Types supported: STRING, NUMBER, INTEGER, BOOLEAN, ARRAY, OBJECT
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
