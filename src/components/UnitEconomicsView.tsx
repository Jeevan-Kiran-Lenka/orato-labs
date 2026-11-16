import React, { useMemo, useState } from 'react';
import { MODEL_PROFILES, USD_TO_INR } from '../lib/models';
import type { BenchmarkResult } from '../types/benchmark';

interface UnitEconomicsViewProps {
  history: BenchmarkResult[];
}

export function UnitEconomicsView({ history }: UnitEconomicsViewProps) {
  const [wordsPerMessage, setWordsPerMessage] = useState(15);
  const [proMonthlyMessages, setProMonthlyMessages] = useState(2200);
  const [fallbackSharePct, setFallbackSharePct] = useState(12);
  const [vadSavingsPct, setVadSavingsPct] = useState(18);
  const [proPriceInr, setProPriceInr] = useState(249);

  const measuredByModel = useMemo(() => {
    const map = new Map<string, { count: number; avgUsd: number; avgMs: number; avgTok: number }>();
    for (const r of history) {
      if (r.status !== 'success') continue;
      const cur = map.get(r.modelId) ?? { count: 0, avgUsd: 0, avgMs: 0, avgTok: 0 };
      const nextCount = cur.count + 1;
      map.set(r.modelId, {
        count: nextCount,
        avgUsd: (cur.avgUsd * cur.count + r.cost.totalUsd) / nextCount,
        avgMs: (cur.avgMs * cur.count + r.latency.totalMs) / nextCount,
        avgTok: (cur.avgTok * cur.count + r.tokens.totalTokens) / nextCount,
      });
    }
    return map;
  }, [history]);

  const defaultFlashCostUsd =
    measuredByModel.get('gemini-3.1-flash-lite-minimal')?.avgUsd ?? 0.00045;
  const fallbackFlashCostUsd =
    measuredByModel.get('gemini-4-hydrogen-low')?.avgUsd ?? 0.00145;

  const blendedPerMsgUsd =
    defaultFlashCostUsd * (1 - fallbackSharePct / 100) +
    fallbackFlashCostUsd * (fallbackSharePct / 100);

  const vadAdjustedPerMsgUsd = blendedPerMsgUsd * (1 - (vadSavingsPct / 100) * 0.25);
  const vadAdjustedPerMsgInr = vadAdjustedPerMsgUsd * USD_TO_INR;

  // Free plan: 2,000 words/week -> ~8,600 words/month
  const freeMonthlyMessages = Math.round((2000 * 4.33) / Math.max(1, wordsPerMessage));
  const freeMonthlyCostInr = freeMonthlyMessages * vadAdjustedPerMsgInr;

  // Pro plan: GST 18% + Play Store 15% fee -> net ~70% of MRP (deck notes ₹179 net on ₹249)
  const netProRevenueInr = proPriceInr * 0.72;
  const proMonthlyAiCostInr = proMonthlyMessages * vadAdjustedPerMsgInr;
  const proGrossProfitInr = netProRevenueInr - proMonthlyAiCostInr;
  const proMarginPct = netProRevenueInr > 0 ? (proGrossProfitInr / netProRevenueInr) * 100 : 0;

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Orato Unit Economics Simulator
        </h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Models Free (2,000 words/week) and Pro margins using live averages from your benchmark runs (or baseline defaults when no runs exist yet).
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Avg Words / Voice Msg
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={wordsPerMessage}
              onChange={(e) => setWordsPerMessage(Number(e.target.value) || 15)}
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Pro Active Msgs / Month
            </label>
            <input
              type="number"
              min={100}
              max={20000}
              step={100}
              value={proMonthlyMessages}
              onChange={(e) => setProMonthlyMessages(Number(e.target.value) || 2000)}
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Fallback Router % (Hydrogen)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={fallbackSharePct}
              onChange={(e) => setFallbackSharePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Silence Trimmed % (VAD)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={vadSavingsPct}
              onChange={(e) => setVadSavingsPct(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Pro MRP (INR / month)
            </label>
            <input
              type="number"
              min={49}
              max={1999}
              value={proPriceInr}
              onChange={(e) => setProPriceInr(Number(e.target.value) || 249)}
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 pt-5 border-t border-slate-200">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs text-slate-500">Blended Cost / Request</div>
            <div className="font-mono text-xl font-semibold text-slate-900 mt-1">
              ₹{vadAdjustedPerMsgInr.toFixed(4)}
            </div>
            <div className="font-mono text-xs text-slate-500 mt-1">
              ${vadAdjustedPerMsgUsd.toFixed(5)} USD
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs text-slate-500">Max Free User Cost / Mo</div>
            <div className="font-mono text-xl font-semibold text-slate-900 mt-1">
              ₹{freeMonthlyCostInr.toFixed(2)}
            </div>
            <div className="font-mono text-xs text-slate-500 mt-1">
              {freeMonthlyMessages} msgs (2k words/wk cap)
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs text-slate-500">Pro AI Spend / Mo</div>
            <div className="font-mono text-xl font-semibold text-slate-900 mt-1">
              ₹{proMonthlyAiCostInr.toFixed(2)}
            </div>
            <div className="font-mono text-xs text-slate-500 mt-1">
              vs ₹{netProRevenueInr.toFixed(0)} net revenue
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs text-slate-500">Pro Contribution Margin</div>
            <div
              className={`font-mono text-xl font-semibold mt-1 ${
                proGrossProfitInr >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              ₹{proGrossProfitInr.toFixed(2)} ({proMarginPct.toFixed(1)}%)
            </div>
            <div className="font-mono text-xs text-slate-500 mt-1">
              After ~28% GST + store fees
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Measured Model Averages From Your Runs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Model Profile</th>
                <th className="py-3 px-3 text-right">Runs</th>
                <th className="py-3 px-3 text-right">Avg Latency</th>
                <th className="py-3 px-3 text-right">Avg Tokens</th>
                <th className="py-3 px-3 text-right">Avg Cost (USD)</th>
                <th className="py-3 px-3 text-right">1,000 Msgs (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {MODEL_PROFILES.map((p) => {
                const m = measuredByModel.get(p.id);
                return (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.label}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {m?.count ?? 0}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {m ? `${Math.round(m.avgMs)} ms` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {m ? Math.round(m.avgTok) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900">
                      {m ? `$${m.avgUsd.toFixed(5)}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900">
                      {m ? `₹${(m.avgUsd * 1000 * USD_TO_INR).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
