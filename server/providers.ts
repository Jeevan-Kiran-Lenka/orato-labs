import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  DEFAULT_ORATO_SCHEMA,
  MODEL_PROFILES,
  USD_TO_INR,
  buildDefaultSystemPrompt,
} from '../src/lib/models.ts';
import type {
  BenchmarkRequestMeta,
  BenchmarkResult,
  ModelProfile,
  OratoOutput,
  ProviderAvailability,
} from '../src/types/benchmark.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getProviderAvailability(): ProviderAvailability {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    groq: Boolean(process.env.GROQ_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    sarvam: Boolean(process.env.SARVAM_API_KEY),
  };
}

const VALID_TYPES: Record<string, Type> = {
  STRING: Type.STRING,
  NUMBER: Type.NUMBER,
  INTEGER: Type.INTEGER,
  BOOLEAN: Type.BOOLEAN,
  ARRAY: Type.ARRAY,
  OBJECT: Type.OBJECT,
  NULL: Type.NULL,
};

function normalizeResponseSchema(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error('Custom responseSchema must be a JSON object.');
  }
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (typeof src.type === 'string') {
    const mapped = VALID_TYPES[src.type.toUpperCase()];
    if (!mapped) {
      throw new Error(`Unsupported schema type "${src.type}". Use STRING, NUMBER, INTEGER, BOOLEAN, ARRAY, OBJECT, or NULL.`);
    }
    out.type = mapped;
  }
  if (typeof src.description === 'string') {
    out.description = src.description;
  }
  if (Array.isArray(src.enum)) {
    out.enum = src.enum;
  }
  if (Array.isArray(src.required)) {
    out.required = src.required.map(String);
  }
  if (src.properties && typeof src.properties === 'object' && !Array.isArray(src.properties)) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src.properties as Record<string, unknown>)) {
      props[k] = normalizeResponseSchema(v);
    }
    if (Object.keys(props).length === 0) {
      throw new Error('OBJECT schema properties cannot be empty.');
    }
    out.properties = props;
  }
  if (src.items && typeof src.items === 'object') {
    out.items = normalizeResponseSchema(src.items);
  }
  return out;
}

const ORATO_RESPONSE_SCHEMA = normalizeResponseSchema(DEFAULT_ORATO_SCHEMA);

function toThinkingLevel(level?: ModelProfile['thinkingLevel']): ThinkingLevel | undefined {
  switch (level) {
    case 'MINIMAL':
      return ThinkingLevel.MINIMAL;
    case 'LOW':
      return ThinkingLevel.LOW;
    case 'MEDIUM':
      return ThinkingLevel.MEDIUM;
    case 'HIGH':
      return ThinkingLevel.HIGH;
    default:
      return undefined;
  }
}

interface ExtractedTokens {
  audioInputTokens: number;
  textInputTokens: number;
  thinkingTokens: number;
  outputTokens: number;
  totalTokens: number;
}

function extractGeminiTokens(
  usage: Record<string, unknown> | undefined,
  audioDurationSec: number,
  hasAudioInput: boolean
): ExtractedTokens {
  const promptTokenCount = Number(usage?.promptTokenCount ?? 0);
  const candidatesTokenCount = Number(usage?.candidatesTokenCount ?? 0);
  const thinkingTokens = Number(usage?.thoughtsTokenCount ?? 0);
  const totalTokenCount = Number(
    usage?.totalTokenCount ?? promptTokenCount + candidatesTokenCount + thinkingTokens
  );

  let audioInputTokens = 0;
  let textInputTokens = promptTokenCount;

  const details = usage?.promptTokensDetails;
  if (Array.isArray(details)) {
    let foundAudio = false;
    let foundText = false;
    let detailAudio = 0;
    let detailText = 0;
    for (const item of details) {
      if (item && typeof item === 'object') {
        const modality = String((item as Record<string, unknown>).modality ?? '').toUpperCase();
        const count = Number((item as Record<string, unknown>).tokenCount ?? 0);
        if (modality === 'AUDIO') {
          detailAudio += count;
          foundAudio = true;
        } else if (modality === 'TEXT') {
          detailText += count;
          foundText = true;
        }
      }
    }
    if (foundAudio || foundText) {
      audioInputTokens = detailAudio;
      textInputTokens = foundText ? detailText : Math.max(0, promptTokenCount - detailAudio);
    }
  } else if (hasAudioInput && promptTokenCount > 0) {
    audioInputTokens = Math.min(promptTokenCount, Math.round(audioDurationSec * 25));
    textInputTokens = Math.max(0, promptTokenCount - audioInputTokens);
  }

  return {
    audioInputTokens,
    textInputTokens,
    thinkingTokens,
    outputTokens: candidatesTokenCount,
    totalTokens: totalTokenCount,
  };
}

const CORE_KEYS = new Set([
  'transcript',
  'spoken_language',
  'output',
  'meaning_preview',
  'ambiguities',
  'confidence_note',
]);

function parseOratoJson(rawText: string | undefined): OratoOutput | undefined {
  if (!rawText) return undefined;
  try {
    const cleaned = rawText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const extraFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!CORE_KEYS.has(k)) {
        extraFields[k] = v;
      }
    }
    return {
      transcript: String(obj.transcript ?? ''),
      spoken_language: String(obj.spoken_language ?? ''),
      output: String(obj.output ?? ''),
      meaning_preview: String(obj.meaning_preview ?? ''),
      ambiguities: Array.isArray(obj.ambiguities)
        ? (obj.ambiguities as OratoOutput['ambiguities'])
        : [],
      confidence_note: obj.confidence_note ? String(obj.confidence_note) : undefined,
      extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
    };
  } catch {
    return undefined;
  }
}

function computeCost(
  profile: ModelProfile,
  tokens: ExtractedTokens,
  audioDurationSec: number
) {
  const asrUsd =
    profile.pricing.asrPerMinuteUsd && audioDurationSec > 0
      ? (audioDurationSec / 60) * profile.pricing.asrPerMinuteUsd
      : 0;

  const inputUsd =
    (tokens.textInputTokens / 1_000_000) * profile.pricing.textInputPer1MUsd +
    (tokens.audioInputTokens / 1_000_000) * profile.pricing.audioInputPer1MUsd;

  const billedOutputTokens = tokens.outputTokens + tokens.thinkingTokens;
  const outputUsd = (billedOutputTokens / 1_000_000) * profile.pricing.outputPer1MUsd;

  const totalUsd = asrUsd + inputUsd + outputUsd;
  return {
    asrUsd,
    inputUsd,
    outputUsd,
    totalUsd,
    totalInr: totalUsd * USD_TO_INR,
  };
}

function getExtensionFromMime(mimeType: string): string {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  return 'webm';
}

async function runExternalAsr(
  profile: ModelProfile,
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ transcript: string; asrMs: number }> {
  const ext = getExtensionFromMime(mimeType);
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  const t0 = performance.now();

  if (profile.provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not configured in .env');

    const form = new FormData();
    form.append('file', blob, `audio.${ext}`);
    form.append('model', profile.asrModel ?? 'whisper-large-v3-turbo');
    form.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq ASR HTTP ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { text?: string };
    return { transcript: data.text ?? '', asrMs: Math.round(performance.now() - t0) };
  }

  if (profile.provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured in .env');

    const form = new FormData();
    form.append('file', blob, `audio.${ext}`);
    form.append('model', profile.asrModel ?? 'gpt-4o-mini-transcribe');
    form.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ASR HTTP ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { text?: string };
    return { transcript: data.text ?? '', asrMs: Math.round(performance.now() - t0) };
  }

  if (profile.provider === 'sarvam') {
    const key = process.env.SARVAM_API_KEY;
    if (!key) throw new Error('SARVAM_API_KEY is not configured in .env');

    const form = new FormData();
    form.append('file', blob, `audio.${ext}`);
    form.append('model', profile.asrModel ?? 'saaras:v3');
    form.append('mode', 'transcribe');

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': key },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sarvam ASR HTTP ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { transcript?: string; text?: string };
    return {
      transcript: data.transcript ?? data.text ?? '',
      asrMs: Math.round(performance.now() - t0),
    };
  }

  throw new Error(`Unsupported external ASR provider: ${profile.provider}`);
}

export async function runModelBenchmark(params: {
  runId: string;
  modelId: string;
  audioBase64: string;
  mimeType: string;
  meta: BenchmarkRequestMeta;
}): Promise<BenchmarkResult> {
  const profile = MODEL_PROFILES.find((m) => m.id === params.modelId);
  if (!profile) {
    throw new Error(`Unknown modelId: ${params.modelId}`);
  }

  const resultId = `${params.runId}_${profile.id}`;
  const timestamp = new Date().toISOString();
  const estimatedAudioTokensAt25PerSec = Math.round(params.meta.audioDurationSec * 25);

  const systemInstruction =
    params.meta.customSystemPrompt?.trim() ||
    buildDefaultSystemPrompt({
      targetLanguage: params.meta.targetLanguage,
      previewLanguage: params.meta.previewLanguage,
      mode: params.meta.mode,
      tone: params.meta.tone,
      previousOutput: params.meta.previousOutput,
      dictionary: params.meta.dictionary,
    });

  try {
    const ai = getGeminiClient();
    const thinkingLevel = toThinkingLevel(profile.thinkingLevel);
    const activeResponseSchema = params.meta.customResponseSchema
      ? normalizeResponseSchema(params.meta.customResponseSchema)
      : structuredClone(ORATO_RESPONSE_SCHEMA);

    const schemaProps = activeResponseSchema.properties as Record<string, Record<string, unknown>> | undefined;
    if (schemaProps?.output) {
      const baseDesc = typeof schemaProps.output.description === 'string'
        ? schemaProps.output.description
        : 'Natural message ready to insert at the cursor.';
      if (!baseDesc.toLowerCase().includes(params.meta.targetLanguage.toLowerCase())) {
        schemaProps.output.description = `${baseDesc} MUST be written in ${params.meta.targetLanguage}.`;
      }
    }

    const userTaskPrompt = [
      `Target output language ("output" MUST be in this language): ${params.meta.targetLanguage}`,
      `Meaning preview language ("meaning_preview"): ${params.meta.previewLanguage}`,
      `Mode: ${params.meta.mode === 'edit' ? 'SPEAK_TO_EDIT' : 'DICTATE_AND_TRANSLATE'}`,
      `Recipient tone: ${params.meta.tone}`,
      params.meta.mode === 'edit' && params.meta.previousOutput?.trim()
        ? `Previous output to edit: """${params.meta.previousOutput.trim()}"""`
        : null,
      params.meta.dictionary.length > 0
        ? `Personal dictionary: ${params.meta.dictionary.join(', ')}`
        : null,
      `Translate and format the spoken audio into ${params.meta.targetLanguage} and return strictly matching JSON.`,
    ]
      .filter(Boolean)
      .join('\n');

    if (profile.pipeline === 'single-call') {
      const t0 = performance.now();
      const response = await ai.models.generateContent({
        model: profile.llmModel,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.mimeType,
                data: params.audioBase64,
              },
            },
            {
              text: userTaskPrompt,
            },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: activeResponseSchema,
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        },
      });
      const totalMs = Math.round(performance.now() - t0);
      const usage = response.usageMetadata as unknown as Record<string, unknown> | undefined;
      const tokens = extractGeminiTokens(usage, params.meta.audioDurationSec, true);
      const rawText = response.text;
      const parsed = parseOratoJson(rawText);

      return {
        id: resultId,
        runId: params.runId,
        timestamp,
        modelId: profile.id,
        modelLabel: profile.label,
        provider: profile.provider,
        pipeline: profile.pipeline,
        thinkingLevel: profile.thinkingLevel,
        status: parsed ? 'success' : 'error',
        error: parsed ? undefined : 'Model returned non-JSON or malformed payload.',
        latency: { asrMs: 0, llmMs: totalMs, totalMs },
        tokens: {
          ...tokens,
          estimatedAudioTokensAt25PerSec,
        },
        cost: computeCost(profile, tokens, params.meta.audioDurationSec),
        parsed,
        rawResponseText: rawText,
        rawUsageMetadata: usage,
        audioDurationSec: params.meta.audioDurationSec,
        targetLanguage: params.meta.targetLanguage,
        previewLanguage: params.meta.previewLanguage,
        mode: params.meta.mode,
        tone: params.meta.tone,
      };
    }

    // Cascaded 2-hop pipeline
    let asrTranscript = '';
    let asrMs = 0;
    let asrAudioTokens = 0;
    let asrTextInputTokens = 0;
    let asrOutputTokens = 0;
    let asrUsageRaw: unknown = undefined;

    if (profile.provider === 'gemini' && profile.asrModel) {
      const tAsr0 = performance.now();
      const asrResp = await ai.models.generateContent({
        model: profile.asrModel,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.mimeType,
                data: params.audioBase64,
              },
            },
            {
              text: 'Transcribe this audio verbatim, preserving code-mixed Indian words accurately.',
            },
          ],
        },
      });
      asrMs = Math.round(performance.now() - tAsr0);
      asrTranscript = (asrResp.text ?? '').trim();
      const asrUsage = asrResp.usageMetadata as unknown as Record<string, unknown> | undefined;
      asrUsageRaw = asrUsage;
      const extractedAsr = extractGeminiTokens(asrUsage, params.meta.audioDurationSec, true);
      asrAudioTokens = extractedAsr.audioInputTokens;
      asrTextInputTokens = extractedAsr.textInputTokens;
      asrOutputTokens = extractedAsr.outputTokens + extractedAsr.thinkingTokens;
    } else {
      const audioBuffer = Buffer.from(params.audioBase64, 'base64');
      const extAsr = await runExternalAsr(profile, audioBuffer, params.mimeType);
      asrTranscript = extAsr.transcript.trim();
      asrMs = extAsr.asrMs;
    }

    const tLlm0 = performance.now();
    const llmResp = await ai.models.generateContent({
      model: profile.llmModel,
      contents: `Raw ASR Transcript:\n"""${asrTranscript}"""\n\n${userTaskPrompt}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: activeResponseSchema,
        ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
      },
    });
    const llmMs = Math.round(performance.now() - tLlm0);
    const totalMs = asrMs + llmMs;

    const llmUsage = llmResp.usageMetadata as unknown as Record<string, unknown> | undefined;
    const llmTokens = extractGeminiTokens(llmUsage, params.meta.audioDurationSec, false);
    const combinedTokens = {
      audioInputTokens: asrAudioTokens,
      textInputTokens: asrTextInputTokens + llmTokens.textInputTokens,
      thinkingTokens: llmTokens.thinkingTokens,
      outputTokens: asrOutputTokens + llmTokens.outputTokens,
      totalTokens:
        asrAudioTokens +
        asrTextInputTokens +
        asrOutputTokens +
        llmTokens.textInputTokens +
        llmTokens.outputTokens +
        llmTokens.thinkingTokens,
      estimatedAudioTokensAt25PerSec,
    };

    const rawText = llmResp.text;
    const parsed = parseOratoJson(rawText);

    return {
      id: resultId,
      runId: params.runId,
      timestamp,
      modelId: profile.id,
      modelLabel: profile.label,
      provider: profile.provider,
      pipeline: profile.pipeline,
      thinkingLevel: profile.thinkingLevel,
      status: parsed ? 'success' : 'error',
      error: parsed ? undefined : 'LLM hop returned malformed JSON.',
      latency: { asrMs, llmMs, totalMs },
      tokens: combinedTokens,
      cost: computeCost(profile, combinedTokens, params.meta.audioDurationSec),
      parsed,
      rawAsrTranscript: asrTranscript,
      rawResponseText: rawText,
      rawUsageMetadata: { asrUsage: asrUsageRaw, llmUsage },
      audioDurationSec: params.meta.audioDurationSec,
      targetLanguage: params.meta.targetLanguage,
      previewLanguage: params.meta.previewLanguage,
      mode: params.meta.mode,
      tone: params.meta.tone,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: resultId,
      runId: params.runId,
      timestamp,
      modelId: profile.id,
      modelLabel: profile.label,
      provider: profile.provider,
      pipeline: profile.pipeline,
      thinkingLevel: profile.thinkingLevel,
      status: 'error',
      error: message,
      latency: { asrMs: 0, llmMs: 0, totalMs: 0 },
      tokens: {
        audioInputTokens: 0,
        textInputTokens: 0,
        thinkingTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedAudioTokensAt25PerSec,
      },
      cost: { asrUsd: 0, inputUsd: 0, outputUsd: 0, totalUsd: 0, totalInr: 0 },
      audioDurationSec: params.meta.audioDurationSec,
      targetLanguage: params.meta.targetLanguage,
      previewLanguage: params.meta.previewLanguage,
      mode: params.meta.mode,
      tone: params.meta.tone,
    };
  }
}
