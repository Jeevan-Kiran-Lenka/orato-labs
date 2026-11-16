import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { AudioRecorderPanel } from './components/AudioRecorderPanel';
import { BackendSpecView } from './components/BackendSpecView';
import { BenchmarkTable } from './components/BenchmarkTable';
import { InspectionDrawer } from './components/InspectionDrawer';
import { ModelSelectorGrid } from './components/ModelSelectorGrid';
import { RunHistoryView } from './components/RunHistoryView';
import { UnitEconomicsView } from './components/UnitEconomicsView';
import { DEFAULT_ORATO_SCHEMA, MODEL_PROFILES } from './lib/models';
import type {
  BenchmarkRequestMeta,
  BenchmarkResult,
  OratoMode,
  ProviderAvailability,
  RecipientTone,
} from './types/benchmark';
import { processAudioBlob, type ProcessedAudio } from './utils/audio';

type ActiveTab = 'benchmark' | 'history' | 'economics' | 'spec';

const HISTORY_STORAGE_KEY = 'orato_lab_benchmark_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('benchmark');
  const [providers, setProviders] = useState<ProviderAvailability>({
    gemini: true,
    groq: false,
    openai: false,
    sarvam: false,
  });

  const [rawAudioBlob, setRawAudioBlob] = useState<Blob | null>(null);
  const [audio, setAudio] = useState<ProcessedAudio | null>(null);
  const [trimSilence, setTrimSilence] = useState(true);

  const [targetLanguage, setTargetLanguage] = useState('English');
  const [previewLanguage, setPreviewLanguage] = useState('Auto (same as spoken language)');
  const [mode, setMode] = useState<OratoMode>('dictate');
  const [tone, setTone] = useState<RecipientTone>('natural');
  const [previousOutput, setPreviousOutput] = useState(
    "There's no class tomorrow. Please do the Chapter 5 homework and send it to me."
  );
  const [dictionaryText, setDictionaryText] = useState(
    'Chapter 5, Sharma Sir, Orato, CBSE, fee receipt'
  );
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [schemaText, setSchemaText] = useState(() =>
    JSON.stringify(DEFAULT_ORATO_SCHEMA, null, 2)
  );
  const { parsedSchema, schemaError } = (() => {
    try {
      const obj = JSON.parse(schemaText) as unknown;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return { parsedSchema: undefined, schemaError: 'Schema must be a JSON object.' };
      }
      return { parsedSchema: obj as Record<string, unknown>, schemaError: null };
    } catch (err) {
      return {
        parsedSchema: undefined,
        schemaError: err instanceof Error ? err.message : 'Invalid JSON syntax.',
      };
    }
  })();

  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([
    'gemini-3.1-flash-lite-minimal',
    'gemini-3.1-flash-lite-low',
    'gemini-4-hydrogen-low',
    'gemini-transcribe-cascaded',
  ]);

  const [currentResults, setCurrentResults] = useState<BenchmarkResult[]>([]);
  const [history, setHistory] = useState<BenchmarkResult[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as BenchmarkResult[]) : [];
    } catch {
      return [];
    }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [inspectedResult, setInspectedResult] = useState<BenchmarkResult | null>(null);

  useEffect(() => {
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data: ProviderAvailability) => {
        setProviders(data);
        setSelectedModelIds((prev) => {
          const valid = prev.filter((id) => {
            const p = MODEL_PROFILES.find((m) => m.id === id);
            if (!p) return false;
            return p.provider === 'gemini' ? data.gemini : data[p.provider] && data.gemini;
          });
          return valid.length > 0 ? valid : ['gemini-3.1-flash-lite-minimal'];
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 150)));
    } catch {
      // ignore storage quota errors
    }
  }, [history]);

  async function handleTrimSilenceChange(next: boolean) {
    setTrimSilence(next);
    if (rawAudioBlob) {
      const reprocessed = await processAudioBlob(rawAudioBlob, { trimSilence: next });
      if (audio?.previewUrl) URL.revokeObjectURL(audio.previewUrl);
      setAudio(reprocessed);
    }
  }

  function handleAudioCaptured(rawBlob: Blob, processed: ProcessedAudio) {
    if (audio?.previewUrl) URL.revokeObjectURL(audio.previewUrl);
    setRawAudioBlob(rawBlob);
    setAudio(processed);
  }

  function handleClearAudio() {
    if (audio?.previewUrl) URL.revokeObjectURL(audio.previewUrl);
    setRawAudioBlob(null);
    setAudio(null);
  }

  function handleToggleModel(id: string) {
    setSelectedModelIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectPreset(preset: 'gemini-only' | 'all-available') {
    if (preset === 'gemini-only') {
      setSelectedModelIds(
        MODEL_PROFILES.filter((m) => m.provider === 'gemini').map((m) => m.id)
      );
      return;
    }
    setSelectedModelIds(
      MODEL_PROFILES.filter((m) =>
        m.provider === 'gemini' ? providers.gemini : providers[m.provider] && providers.gemini
      ).map((m) => m.id)
    );
  }

  async function handleRunBenchmark() {
    if (!audio || isRunning) return;

    const runnableIds = selectedModelIds.filter((id) => {
      const p = MODEL_PROFILES.find((m) => m.id === id);
      if (!p) return false;
      return p.provider === 'gemini' ? providers.gemini : providers[p.provider] && providers.gemini;
    });

    if (runnableIds.length === 0) return;

    const runId = `run_${Date.now()}`;
    const dictionary = dictionaryText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (schemaError || !parsedSchema) return;

    const meta: BenchmarkRequestMeta = {
      targetLanguage,
      previewLanguage,
      mode,
      tone,
      previousOutput: mode === 'edit' ? previousOutput : '',
      dictionary,
      customSystemPrompt: customSystemPrompt.trim() || undefined,
      customResponseSchema: parsedSchema,
      audioDurationSec: audio.trimmedDurationSec,
      rawDurationSec: audio.rawDurationSec,
      trimmedSilenceSec: audio.trimmedSilenceSec,
      audioBytes: audio.bytes,
    };

    const pendingPlaceholders: BenchmarkResult[] = runnableIds.map((id) => {
      const profile = MODEL_PROFILES.find((m) => m.id === id)!;
      return {
        id: `${runId}_${profile.id}`,
        runId,
        timestamp: new Date().toISOString(),
        modelId: profile.id,
        modelLabel: profile.label,
        provider: profile.provider,
        pipeline: profile.pipeline,
        thinkingLevel: profile.thinkingLevel,
        status: 'pending',
        latency: { asrMs: 0, llmMs: 0, totalMs: 0 },
        tokens: {
          audioInputTokens: 0,
          textInputTokens: 0,
          thinkingTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedAudioTokensAt25PerSec: audio.estimatedTrimmedAudioTokens,
        },
        cost: { asrUsd: 0, inputUsd: 0, outputUsd: 0, totalUsd: 0, totalInr: 0 },
        audioDurationSec: audio.trimmedDurationSec,
        targetLanguage,
        previewLanguage,
        mode,
        tone,
      };
    });

    setCurrentResults(pendingPlaceholders);
    setIsRunning(true);

    const completed: BenchmarkResult[] = [];

    await Promise.allSettled(
      runnableIds.map(async (modelId) => {
        try {
          const res = await fetch('/api/benchmark/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              runId,
              modelId,
              audioBase64: audio.base64,
              mimeType: audio.mimeType,
              meta,
            }),
          });
          const data = (await res.json()) as BenchmarkResult & { error?: string };
          const normalized: BenchmarkResult = res.ok
            ? data
            : {
                ...pendingPlaceholders.find((p) => p.modelId === modelId)!,
                status: 'error',
                error: data.error ?? `HTTP ${res.status}`,
              };

          completed.push(normalized);
          setCurrentResults((prev) =>
            prev.map((row) => (row.modelId === modelId ? normalized : row))
          );
        } catch (err) {
          const failed: BenchmarkResult = {
            ...pendingPlaceholders.find((p) => p.modelId === modelId)!,
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
          };
          completed.push(failed);
          setCurrentResults((prev) =>
            prev.map((row) => (row.modelId === modelId ? failed : row))
          );
        }
      })
    );

    setHistory((prev) => [...completed, ...prev]);
    setIsRunning(false);
  }

  function handleExportCsv() {
    const rowsToExport = currentResults.length > 0 ? currentResults : history;
    if (rowsToExport.length === 0) return;

    const headers = [
      'timestamp',
      'runId',
      'modelLabel',
      'pipeline',
      'status',
      'audioDurationSec',
      'totalMs',
      'asrMs',
      'llmMs',
      'audioInputTokens',
      'textInputTokens',
      'thinkingTokens',
      'outputTokens',
      'totalTokens',
      'totalUsd',
      'totalInr',
      'spoken_language',
      'transcript',
      'output',
      'meaning_preview',
      'error',
    ];

    const escapeCell = (val: unknown) => {
      const s = String(val ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const csvLines = [
      headers.join(','),
      ...rowsToExport.map((r) =>
        [
          r.timestamp,
          r.runId,
          r.modelLabel,
          r.pipeline,
          r.status,
          r.audioDurationSec.toFixed(2),
          r.latency.totalMs,
          r.latency.asrMs,
          r.latency.llmMs,
          r.tokens.audioInputTokens,
          r.tokens.textInputTokens,
          r.tokens.thinkingTokens,
          r.tokens.outputTokens,
          r.tokens.totalTokens,
          r.cost.totalUsd.toFixed(6),
          r.cost.totalInr.toFixed(4),
          r.parsed?.spoken_language ?? '',
          r.parsed?.transcript ?? '',
          r.parsed?.output ?? '',
          r.parsed?.meaning_preview ?? '',
          r.error ?? '',
        ]
          .map(escapeCell)
          .join(',')
      ),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orato-benchmark-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: Brand wordmark — Nav links — 1 primary CTA */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1380px] mx-auto px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="#benchmark"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('benchmark');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Orato Lab
          </a>

          <nav className="flex items-center gap-6 text-sm font-medium">
            {(
              [
                ['benchmark', 'Benchmark'],
                ['history', 'Run History'],
                ['economics', 'Unit Economics'],
                ['spec', 'Backend Spec'],
              ] as const
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  activeTab === tabId
                    ? 'text-slate-900 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={currentResults.length === 0 && history.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-6 space-y-5">
        {activeTab === 'benchmark' && (
          <>
            <AudioRecorderPanel
              audio={audio}
              trimSilence={trimSilence}
              onTrimSilenceChange={handleTrimSilenceChange}
              onAudioCaptured={handleAudioCaptured}
              onClearAudio={handleClearAudio}
              targetLanguage={targetLanguage}
              onTargetLanguageChange={setTargetLanguage}
              previewLanguage={previewLanguage}
              onPreviewLanguageChange={setPreviewLanguage}
              mode={mode}
              onModeChange={setMode}
              tone={tone}
              onToneChange={setTone}
              previousOutput={previousOutput}
              onPreviousOutputChange={setPreviousOutput}
              dictionaryText={dictionaryText}
              onDictionaryTextChange={setDictionaryText}
              customSystemPrompt={customSystemPrompt}
              onCustomSystemPromptChange={setCustomSystemPrompt}
              schemaText={schemaText}
              onSchemaTextChange={setSchemaText}
              schemaError={schemaError}
            />

            <ModelSelectorGrid
              selectedModelIds={selectedModelIds}
              onToggleModel={handleToggleModel}
              onSelectPreset={handleSelectPreset}
              providers={providers}
              hasAudio={Boolean(audio) && !schemaError}
              isRunning={isRunning}
              onRunBenchmark={handleRunBenchmark}
            />

            <BenchmarkTable
              results={currentResults}
              onInspect={(res) => setInspectedResult(res)}
            />
          </>
        )}

        {activeTab === 'history' && (
          <RunHistoryView
            history={history}
            onInspect={(res) => setInspectedResult(res)}
            onClearHistory={() => setHistory([])}
          />
        )}

        {activeTab === 'economics' && <UnitEconomicsView history={history} />}

        {activeTab === 'spec' && <BackendSpecView />}
      </main>

      <InspectionDrawer
        result={inspectedResult}
        onClose={() => setInspectedResult(null)}
      />
    </div>
  );
}
