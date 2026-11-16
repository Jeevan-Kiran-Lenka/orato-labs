# Orato Lab

A local full-stack voice-to-translate benchmarking playground built to evaluate latency, exact token usage, unit economics, and translation/meaning-preview quality across **single-call multimodal Gemini models** and **cascaded 2-hop ASR + LLM pipelines** for **Orato**.

---

## Features

- **Voice Capture & Browser Audio Normalization (`src/utils/audio.ts`)**
  - Record directly from the browser microphone with a live frequency waveform or upload `.wav`, `.mp3`, `.webm`, `.ogg`, or `.m4a` test clips.
  - Resamples audio to **16 kHz mono 16-bit PCM WAV** for consistent cross-provider evaluation.
  - Toggleable **client-side VAD silence trimming** (with a 140 ms safety pad) showing raw vs. active duration, KB payload, and estimated audio tokens saved (`~25 tokens/sec`).
- **Orato Context Controls**
  - Configure **Target Output Language**, **Meaning Preview Language**, **Recipient Tone Preset** (`Natural`, `Polite / Respectful`, `Professional`, `Customer Support`, `Casual`), **Interaction Mode** (`Dictate` vs. `Speak to Edit` with `previousOutput`), and **Personal Dictionary**.
- **Prompt & Structured Output Schema Tuner**
  - Live-edit the **System Instruction** and **Gemini `responseSchema` JSON** directly in the UI with syntax validation and 1-click presets (`Default 6-field` vs. `Minimal 4-field Deck` schema).
- **Parallel Benchmarking & Token Telemetry**
  - Executes selected models concurrently and populates a sortable comparison table with:
    - Total latency (`ms`) and ASR/LLM hop breakdown
    - Exact token split: **Audio In**, **Text In**, **Thinking**, **Output**, and **Total**
    - Estimated cost per request in **USD** and **INR**
    - Generated `output`, back-translated `meaning_preview`, verbatim `transcript`, and any custom schema fields
  - **Inspection Drawer** displays full raw JSON output, intermediate ASR transcript (for 2-hop pipelines), and raw `usageMetadata`.
- **Run History, CSV Export & Unit Economics Simulator**
  - Persists benchmark runs in `localStorage` with search/model filtering and CSV export.
  - Interactive **Unit Economics Simulator** calculates Free (`2,000 words/week`) and Pro (`₹249/month`) margins using live measured averages from your runs.

---

## Supported Models & Pipelines

| Profile | Provider | Pipeline | Thinking Level |
| :--- | :--- | :--- | :--- |
| `gemini-3.1-flash-lite-minimal` | Google Gemini | Single-call native audio | `MINIMAL` |
| `gemini-3.1-flash-lite-low` | Google Gemini | Single-call native audio | `LOW` |
| `gemini-4-hydrogen-low` | Google Gemini | Single-call native audio | `LOW` |
| `gemini-4-hydrogen-medium` | Google Gemini | Single-call native audio | `MEDIUM` |
| `gemini-transcribe-cascaded` | Google Gemini | 2-hop (`gemini-3.5-transcribe` → `gemini-4-hydrogen`) | `LOW` |
| `groq-whisper-turbo-cascaded` | Groq + Gemini | 2-hop (`whisper-large-v3-turbo` → `gemini-3.1-flash-lite`) | `MINIMAL` |
| `openai-gpt4o-mini-transcribe-cascaded` | OpenAI + Gemini | 2-hop (`gpt-4o-mini-transcribe` → `gemini-3.1-flash-lite`) | `MINIMAL` |
| `sarvam-saaras-cascaded` | Sarvam AI + Gemini | 2-hop (`saaras:v3` → `gemini-3.1-flash-lite`) | `MINIMAL` |

---

## Local Setup

### 1. Prerequisites
- Node.js `>= 22`
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- Optional keys for multi-provider benchmarking:
  - [Groq Console](https://console.groq.com/keys) (`GROQ_API_KEY`)
  - [OpenAI Platform](https://platform.openai.com/api-keys) (`OPENAI_API_KEY`)
  - [Sarvam AI Dashboard](https://dashboard.sarvam.ai) (`SARVAM_API_KEY`)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and replace `"MY_GEMINI_API_KEY"` with your real key:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY="AIza..."

# Optional third-party provider keys
OPENAI_API_KEY=""
GROQ_API_KEY=""
SARVAM_API_KEY=""

APP_URL="http://localhost:3000"
```

> **Note:** API keys are read strictly on the Express server (`server.ts` / `server/providers.ts`) and are never exposed to the browser. Restart `npm run dev` whenever you update `.env`.

### 4. Start the Development Server

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express + Vite middleware dev server via `tsx server.ts` on port `3000`. |
| `npm run build` | Builds the React frontend bundle into `dist/`. |
| `npm run start` | Runs the production server (`node server.ts`). |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`). |
| `npm run clean` | Removes `dist/` and `server.js`. |

---

## Project Structure

```text
├── server.ts                  # Express entrypoint + Vite middleware & API routes
├── server/
│   └── providers.ts           # Gemini, Groq, OpenAI, and Sarvam benchmark runners
├── src/
│   ├── App.tsx                # Top-level state, parallel runner, CSV export, navigation
│   ├── index.css              # Tailwind CSS v4 & typography setup
│   ├── lib/
│   │   └── models.ts          # Model catalog, pricing specs, prompt builder, schema presets
│   ├── types/
│   │   └── benchmark.ts       # Shared TypeScript interfaces
│   ├── utils/
│   │   └── audio.ts           # Browser audio decoding, 16 kHz WAV encoding, VAD trimming
│   └── components/
│       ├── AudioRecorderPanel.tsx
│       ├── ModelSelectorGrid.tsx
│       ├── BenchmarkTable.tsx
│       ├── InspectionDrawer.tsx
│       ├── RunHistoryView.tsx
│       ├── UnitEconomicsView.tsx
│       └── BackendSpecView.tsx
├── .env.example
└── package.json
```

---

## Server API Endpoints

- `GET /api/health` — Server health check.
- `GET /api/providers` — Returns non-secret boolean availability flags (`{ gemini, groq, openai, sarvam }`) based on `.env`.
- `POST /api/benchmark/run` — Executes a single model profile (`modelId`) against an uploaded base64 audio payload and returns latency, token breakdown, cost, and parsed structured JSON.
