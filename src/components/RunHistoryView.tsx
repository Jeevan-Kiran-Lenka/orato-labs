import React, { useMemo, useState } from 'react';
import { Eye, Search, Trash2 } from 'lucide-react';
import type { BenchmarkResult } from '../types/benchmark';

interface RunHistoryViewProps {
  history: BenchmarkResult[];
  onInspect: (result: BenchmarkResult) => void;
  onClearHistory: () => void;
}

export function RunHistoryView({
  history,
  onInspect,
  onClearHistory,
}: RunHistoryViewProps) {
  const [query, setQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('all');

  const modelOptions = useMemo(() => {
    const names = Array.from(new Set(history.map((r) => r.modelLabel)));
    return names;
  }, [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((item) => {
      if (modelFilter !== 'all' && item.modelLabel !== modelFilter) return false;
      if (!q) return true;
      return (
        item.modelLabel.toLowerCase().includes(q) ||
        (item.parsed?.output ?? '').toLowerCase().includes(q) ||
        (item.parsed?.transcript ?? '').toLowerCase().includes(q) ||
        (item.parsed?.meaning_preview ?? '').toLowerCase().includes(q)
      );
    });
  }, [history, query, modelFilter]);

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Saved Benchmark Run History
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {history.length} stored evaluations across your local test recordings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcript or output..."
              className="h-9 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900"
          >
            <option value="all">All Models</option>
            {modelOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-md hover:bg-red-50 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-800">
            {history.length === 0 ? 'No runs saved yet' : 'No runs match your filter'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Run a benchmark from the Benchmark tab to populate historical latency, token, and cost data.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
                <th className="py-3 px-4 whitespace-nowrap">Model</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Audio</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Latency</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Tokens</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Cost (INR)</th>
                <th className="py-3 px-4 min-w-[220px]">Output</th>
                <th className="py-3 px-4 min-w-[220px]">Meaning Preview</th>
                <th className="py-3 px-3 whitespace-nowrap">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap align-top">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-medium text-slate-900 whitespace-nowrap">{item.modelLabel}</div>
                    <div className="text-xs text-slate-500">
                      {item.targetLanguage} · {item.tone}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-700 align-top whitespace-nowrap">
                    {item.audioDurationSec.toFixed(1)}s
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-900 align-top whitespace-nowrap">
                    {item.status === 'success' ? `${item.latency.totalMs} ms` : 'Error'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-900 align-top whitespace-nowrap">
                    {item.tokens.totalTokens}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-900 align-top whitespace-nowrap">
                    ₹{item.cost.totalInr.toFixed(3)}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-800 align-top">
                    {item.parsed?.output ?? item.error ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 align-top">
                    {item.parsed?.meaning_preview ?? '—'}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <button
                      type="button"
                      onClick={() => onInspect(item)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
