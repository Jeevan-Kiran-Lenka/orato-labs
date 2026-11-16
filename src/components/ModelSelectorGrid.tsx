import React from 'react';
import { Play } from 'lucide-react';
import { MODEL_PROFILES } from '../lib/models';
import type { ProviderAvailability, ProviderId } from '../types/benchmark';

interface ModelSelectorGridProps {
  selectedModelIds: string[];
  onToggleModel: (id: string) => void;
  onSelectPreset: (preset: 'gemini-only' | 'all-available') => void;
  providers: ProviderAvailability;
  hasAudio: boolean;
  isRunning: boolean;
  onRunBenchmark: () => void;
}

const PROVIDER_ENV_NAME: Record<ProviderId, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  sarvam: 'SARVAM_API_KEY',
};

const PROVIDER_DISPLAY: Record<ProviderId, string> = {
  gemini: 'Google Gemini',
  groq: 'Groq + Gemini',
  openai: 'OpenAI + Gemini',
  sarvam: 'Sarvam + Gemini',
};

export function ModelSelectorGrid({
  selectedModelIds,
  onToggleModel,
  onSelectPreset,
  providers,
  hasAudio,
  isRunning,
  onRunBenchmark,
}: ModelSelectorGridProps) {
  function isProviderReady(provider: ProviderId): boolean {
    if (provider === 'gemini') return providers.gemini;
    // Cascaded 3rd-party pipelines also use Gemini for the final structured JSON hop
    return providers[provider] && providers.gemini;
  }

  const readySelectedCount = selectedModelIds.filter((id) => {
    const m = MODEL_PROFILES.find((p) => p.id === id);
    return m ? isProviderReady(m.provider) : false;
  }).length;

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            02. Select Models & Pipelines to Benchmark
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Run single-call native audio models against cascaded 2-hop pipelines in parallel. Providers are enabled automatically from your server <span className="font-mono text-xs">.env</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectPreset('gemini-only')}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            Select All Gemini
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset('all-available')}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            Select All Ready
          </button>
          <button
            type="button"
            onClick={onRunBenchmark}
            disabled={!hasAudio || isRunning || readySelectedCount === 0}
            title={!hasAudio ? 'Record or upload an audio clip in Step 01 first' : undefined}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            {isRunning
              ? 'Running Benchmark...'
              : !hasAudio
                ? 'Capture Audio First'
                : `Run ${readySelectedCount} Selected Model${readySelectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {MODEL_PROFILES.map((model) => {
          const ready = isProviderReady(model.provider);
          const checked = selectedModelIds.includes(model.id);

          return (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                if (ready) onToggleModel(model.id);
              }}
              disabled={!ready}
              className={`text-left p-3.5 rounded-md border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                !ready
                  ? 'bg-slate-50 border-slate-200 opacity-65'
                  : checked
                    ? 'bg-blue-50/50 border-blue-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 leading-snug">
                  {model.label}
                </span>
                <input
                  type="checkbox"
                  checked={checked && ready}
                  readOnly
                  tabIndex={-1}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 shrink-0"
                />
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                <span>{PROVIDER_DISPLAY[model.provider]}</span>
                <span aria-hidden="true">·</span>
                <span>{model.pipeline === 'single-call' ? 'Single-call' : '2-hop'}</span>
              </div>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-2">
                {model.description}
              </p>

              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-700">
                  {model.pricing.asrPerMinuteUsd
                    ? `$${model.pricing.asrPerMinuteUsd.toFixed(4)}/min + LLM`
                    : `$${model.pricing.audioInputPer1MUsd.toFixed(2)} in / $${model.pricing.outputPer1MUsd.toFixed(2)} out`}
                </span>
                {!ready ? (
                  <span className="text-amber-700">Set {PROVIDER_ENV_NAME[model.provider]}</span>
                ) : (
                  <span className="text-emerald-700">Ready</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
