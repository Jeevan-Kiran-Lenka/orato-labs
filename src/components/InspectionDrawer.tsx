import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { BenchmarkResult } from '../types/benchmark';

interface InspectionDrawerProps {
  result: BenchmarkResult | null;
  onClose: () => void;
}

export function InspectionDrawer({ result, onClose }: InspectionDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const fullPayload = JSON.stringify(
    {
      modelId: result.modelId,
      pipeline: result.pipeline,
      latency: result.latency,
      tokens: result.tokens,
      cost: result.cost,
      rawAsrTranscript: result.rawAsrTranscript,
      parsed: result.parsed,
      rawUsageMetadata: result.rawUsageMetadata,
    },
    null,
    2
  );

  function handleCopy() {
    navigator.clipboard.writeText(fullPayload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35">
      <div className="w-full max-w-xl bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {result.modelLabel}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {result.pipeline} · {result.audioDurationSec.toFixed(2)}s audio · {result.latency.totalMs} ms
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
              aria-label="Close inspection panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {result.error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-md text-xs font-mono text-red-800">
              {result.error}
            </div>
          )}

          {/* Token Audit Grid */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">
              Token & Cost Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-slate-500">Audio Input</div>
                <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
                  {result.tokens.audioInputTokens} tok
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  Est @25/s: {result.tokens.estimatedAudioTokensAt25PerSec}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-slate-500">Text Input</div>
                <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
                  {result.tokens.textInputTokens} tok
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  Prompt + dict + schema
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-slate-500">Thinking Tokens</div>
                <div className="font-mono text-sm font-semibold text-amber-700 mt-0.5">
                  {result.tokens.thinkingTokens} tok
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  Billed at output rate
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-slate-500">JSON Output</div>
                <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
                  {result.tokens.outputTokens} tok
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-slate-500">Cost / Request</div>
                <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
                  ${result.cost.totalUsd.toFixed(5)}
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  ₹{result.cost.totalInr.toFixed(3)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-slate-500">Cost Breakdown</div>
                <div className="font-mono text-[11px] text-slate-700 mt-1">
                  ASR: ${result.cost.asrUsd.toFixed(5)}
                </div>
                <div className="font-mono text-[11px] text-slate-700">
                  In: ${result.cost.inputUsd.toFixed(5)} · Out: ${result.cost.outputUsd.toFixed(5)}
                </div>
              </div>
            </div>
          </div>

          {result.rawAsrTranscript !== undefined && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-1.5">
                Hop 1 Intermediate ASR Transcript
              </h4>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono text-slate-800 whitespace-pre-wrap">
                {result.rawAsrTranscript || '(empty transcript)'}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-1.5">
              Raw Structured JSON Response
            </h4>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {result.rawResponseText ?? '(no response body)'}
            </pre>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-1.5">
              Raw API usageMetadata
            </h4>
            <pre className="p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(result.rawUsageMetadata ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
