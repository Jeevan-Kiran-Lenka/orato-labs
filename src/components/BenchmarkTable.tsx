import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Eye } from 'lucide-react';
import type { BenchmarkResult } from '../types/benchmark';

interface BenchmarkTableProps {
  results: BenchmarkResult[];
  onInspect: (result: BenchmarkResult) => void;
}

type SortKey = 'default' | 'latency' | 'cost' | 'tokens';

export function BenchmarkTable({ results, onInspect }: BenchmarkTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('default');

  const stats = useMemo(() => {
    const successes = results.filter((r) => r.status === 'success');
    if (successes.length === 0) return { fastestId: null, cheapestId: null, lowestTokId: null };
    const fastest = [...successes].sort((a, b) => a.latency.totalMs - b.latency.totalMs)[0];
    const cheapest = [...successes].sort((a, b) => a.cost.totalUsd - b.cost.totalUsd)[0];
    const lowestTok = [...successes].sort((a, b) => a.tokens.totalTokens - b.tokens.totalTokens)[0];
    return {
      fastestId: fastest.id,
      cheapestId: cheapest.id,
      lowestTokId: lowestTok.id,
    };
  }, [results]);

  const sortedResults = useMemo(() => {
    if (sortKey === 'default') return results;
    return [...results].sort((a, b) => {
      if (a.status !== 'success' && b.status === 'success') return 1;
      if (a.status === 'success' && b.status !== 'success') return -1;
      if (sortKey === 'latency') return a.latency.totalMs - b.latency.totalMs;
      if (sortKey === 'cost') return a.cost.totalUsd - b.cost.totalUsd;
      return a.tokens.totalTokens - b.tokens.totalTokens;
    });
  }, [results, sortKey]);

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            03. Live Model Performance & Token Comparison
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Side-by-side latency, exact API token split (audio, text, thinking, output), cost per request, and verification preview.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">Sort by:</span>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(
              [
                ['default', 'Order'],
                ['latency', 'Latency'],
                ['cost', 'Cost'],
                ['tokens', 'Tokens'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-sm cursor-pointer whitespace-nowrap ${
                  sortKey === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-800">No benchmark results yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Record or upload a Hinglish/Tanglish voice clip above, select two or more models, and run the benchmark to inspect token consumption and translation accuracy.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">Model & Pipeline</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSortKey('latency')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    Latency <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Audio In</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Text In</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Think</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Output</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSortKey('tokens')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    Total Tok <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSortKey('cost')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    Cost (USD / INR) <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 min-w-[240px]">Inserted Output (`output`)</th>
                <th className="py-3 px-4 min-w-[240px]">Meaning Preview (`meaning_preview`)</th>
                <th className="py-3 px-3 whitespace-nowrap">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {sortedResults.map((row) => {
                if (row.status === 'pending') {
                  return (
                    <tr key={row.id} className="bg-white">
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">{row.modelLabel}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {row.pipeline} · Running request...
                        </div>
                      </td>
                      <td colSpan={10} className="py-3.5 px-4">
                        <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  );
                }

                if (row.status === 'error') {
                  return (
                    <tr key={row.id} className="bg-red-50/40">
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">{row.modelLabel}</div>
                        <div className="text-xs text-red-700 mt-0.5">Error · {row.pipeline}</div>
                      </td>
                      <td colSpan={9} className="py-3.5 px-4 text-xs font-mono text-red-700">
                        {row.error ?? 'Unknown request error'}
                      </td>
                      <td className="py-3.5 px-3 align-top">
                        <button
                          type="button"
                          onClick={() => onInspect(row)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-700 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  );
                }

                const tags: string[] = [];
                if (row.id === stats.fastestId) tags.push('Fastest');
                if (row.id === stats.cheapestId) tags.push('Cheapest');
                if (row.id === stats.lowestTokId) tags.push('Lowest tokens');

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-semibold text-slate-900 whitespace-nowrap">
                        {row.modelLabel}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                        {row.pipeline === 'single-call' ? 'Single-call' : '2-hop cascaded'}
                        {row.parsed?.spoken_language ? ` · ${row.parsed.spoken_language}` : ''}
                      </div>
                      {tags.length > 0 && (
                        <div className="text-xs font-medium text-emerald-700 mt-1">
                          {tags.join(' · ')}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right align-top font-mono whitespace-nowrap">
                      <div className="font-medium text-slate-900">{row.latency.totalMs} ms</div>
                      {row.latency.asrMs > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          ASR {row.latency.asrMs} + LLM {row.latency.llmMs}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right align-top font-mono text-slate-800 whitespace-nowrap">
                      {row.tokens.audioInputTokens}
                    </td>

                    <td className="py-3.5 px-3 text-right align-top font-mono text-slate-800 whitespace-nowrap">
                      {row.tokens.textInputTokens}
                    </td>

                    <td className="py-3.5 px-3 text-right align-top font-mono whitespace-nowrap">
                      <span
                        className={
                          row.tokens.thinkingTokens > 0
                            ? 'text-amber-700 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {row.tokens.thinkingTokens}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right align-top font-mono text-slate-800 whitespace-nowrap">
                      {row.tokens.outputTokens}
                    </td>

                    <td className="py-3.5 px-3 text-right align-top font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {row.tokens.totalTokens}
                    </td>

                    <td className="py-3.5 px-3 text-right align-top font-mono whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        ${row.cost.totalUsd.toFixed(5)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        ₹{row.cost.totalInr.toFixed(3)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top text-slate-900 leading-relaxed">
                      <div>{row.parsed?.output}</div>
                      {row.parsed?.transcript && (
                        <div className="mt-1.5 text-xs text-slate-500">
                          Heard: &ldquo;{row.parsed.transcript}&rdquo;
                        </div>
                      )}
                      {row.parsed?.extraFields && (
                        <div className="mt-1.5 text-xs font-mono text-blue-700">
                          {Object.entries(row.parsed.extraFields)
                            .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
                            .join(' · ')}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top text-slate-800 leading-relaxed">
                      <div>{row.parsed?.meaning_preview}</div>
                      {row.parsed?.ambiguities && row.parsed.ambiguities.length > 0 && (
                        <div className="mt-1.5 text-xs text-amber-700">
                          Ambiguity: {row.parsed.ambiguities.map((a) => `${a.phrase} (${a.chosen} / ${a.alternative})`).join('; ')}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 align-top whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspect(row)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
