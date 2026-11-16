import React from 'react';

export function BackendSpecView() {
  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Production Architecture Blueprint (Go + Cloud Run asia-south1 + Firebase)
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Reference implementation notes for taking your winning benchmark configuration from this local playground into Orato&apos;s production Go service.
        </p>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900">
              1. Client & Transport Optimization (India 4G/5G)
            </h3>
            <ul className="text-xs text-slate-700 space-y-1.5 leading-relaxed list-disc pl-4">
              <li>
                Record 16 kHz mono on Android/iOS/Desktop and encode with <span className="font-mono">Opus (.ogg)</span> or <span className="font-mono">AAC (.m4a)</span> at 16–24 kbps (~20 KB per 10s vs 320 KB WAV).
              </li>
              <li>
                Run client-side RMS VAD silence trimming (keep ~140 ms pad) to eliminate 25–50 wasted audio input tokens per tap.
              </li>
              <li>
                Upload via <span className="font-mono">multipart/form-data</span> instead of Base64 JSON to save 33% upload overhead.
              </li>
            </ul>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900">
              2. Cloud Run (asia-south1) Request Lifecycle
            </h3>
            <ul className="text-xs text-slate-700 space-y-1.5 leading-relaxed list-disc pl-4">
              <li>
                Verify both Firebase Auth ID token and <span className="font-mono">Firebase App Check</span> token before reading audio bytes.
              </li>
              <li>
                Cache user tier, weekly word quota, and personal dictionary in-memory / Redis (60s TTL) to avoid synchronous Firestore RTT (~60 ms) on every dictation.
              </li>
              <li>
                Route standard clips (&le; 20s) to <span className="font-mono">gemini-3.1-flash-lite</span> (<span className="font-mono">ThinkingLevel.MINIMAL</span>) and escalate <span className="font-mono">Speak to edit</span> / long clips to <span className="font-mono">gemini-4-hydrogen</span>.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            3. Local Multi-Provider .env Configuration
          </h3>
          <p className="text-xs text-slate-600 mb-2">
            When running this playground locally (<span className="font-mono">npm run dev</span>), add any keys you want to benchmark in your local <span className="font-mono">.env</span> file and restart the server. Keys are read exclusively on the Express backend and never sent to the browser.
          </p>
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-md text-xs font-mono overflow-x-auto">
{`GEMINI_API_KEY="your-gemini-key"
GROQ_API_KEY="your-groq-key"       # Enables Groq Whisper v3 Turbo -> Flash-Lite
OPENAI_API_KEY="your-openai-key"   # Enables GPT-4o Mini Transcribe -> Flash-Lite
SARVAM_API_KEY="your-sarvam-key"   # Enables Sarvam Saaras v3 -> Flash-Lite`}
          </pre>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            4. Go Vertex AI / Gemini Structured JSON Contract
          </h3>
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-md text-xs font-mono overflow-x-auto">
{`type OratoResponse struct {
    Transcript     string      \`json:"transcript"\`
    SpokenLanguage string      \`json:"spoken_language"\`
    Output         string      \`json:"output"\`
    MeaningPreview string      \`json:"meaning_preview"\`
    Ambiguities    []Ambiguity \`json:"ambiguities,omitempty"\`
}

// Privacy invariant: hold uploaded audio strictly in []byte in RAM,
// disable HTTP request body logging, and call paid-tier Vertex AI (asia-south1).`}
          </pre>
        </div>
      </section>
    </div>
  );
}
