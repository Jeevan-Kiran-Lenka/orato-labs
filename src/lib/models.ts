import type { ModelProfile, OratoMode, RecipientTone } from '../types/benchmark';

export const USD_TO_INR = 85.5;

export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'gemini-3.1-flash-lite-minimal',
    label: 'Gemini 3.1 Flash-Lite · Minimal',
    provider: 'gemini',
    pipeline: 'single-call',
    llmModel: 'gemini-3.1-flash-lite',
    thinkingLevel: 'MINIMAL',
    description: 'Single-call native audio to structured JSON with zero reasoning overhead.',
    recommendedFor: 'Default dictation & translation (lowest cost + sub-second latency)',
    pricing: {
      textInputPer1MUsd: 0.25,
      audioInputPer1MUsd: 0.50,
      outputPer1MUsd: 1.50,
      note: '25 audio tok/sec · ThinkingLevel.MINIMAL',
    },
  },
  {
    id: 'gemini-3.1-flash-lite-low',
    label: 'Gemini 3.1 Flash-Lite · Low Think',
    provider: 'gemini',
    pipeline: 'single-call',
    llmModel: 'gemini-3.1-flash-lite',
    thinkingLevel: 'LOW',
    description: 'Single-call native audio with light reasoning for trickier code-mixing.',
    recommendedFor: 'Testing whether light reasoning improves ambiguous Hinglish/Tanglish',
    pricing: {
      textInputPer1MUsd: 0.25,
      audioInputPer1MUsd: 0.50,
      outputPer1MUsd: 1.50,
      note: '25 audio tok/sec · ThinkingLevel.LOW adds output tokens',
    },
  },
  {
    id: 'gemini-4-hydrogen-low',
    label: 'Gemini 4 Hydrogen · Low Think',
    provider: 'gemini',
    pipeline: 'single-call',
    llmModel: 'gemini-4-hydrogen',
    thinkingLevel: 'LOW',
    description: 'Flagship fast Flash-class model for nuanced translation and tone control.',
    recommendedFor: 'Quality fallback for Speak-to-edit, polite rewrites, & noisy clips',
    pricing: {
      textInputPer1MUsd: 1.50,
      audioInputPer1MUsd: 1.50,
      outputPer1MUsd: 7.50,
      note: 'Gemini 4 Flash-tier flat multimodal token pricing',
    },
  },
  {
    id: 'gemini-4-hydrogen-medium',
    label: 'Gemini 4 Hydrogen · Medium Think',
    provider: 'gemini',
    pipeline: 'single-call',
    llmModel: 'gemini-4-hydrogen',
    thinkingLevel: 'MEDIUM',
    description: 'Balanced reasoning depth for complex multi-clause edits & formal emails.',
    recommendedFor: 'Quality ceiling benchmark (measures extra thinking token cost)',
    pricing: {
      textInputPer1MUsd: 1.50,
      audioInputPer1MUsd: 1.50,
      outputPer1MUsd: 7.50,
      note: 'ThinkingLevel.MEDIUM · Higher thinking token budget',
    },
  },
  {
    id: 'gemini-transcribe-cascaded',
    label: 'Gemini 3.5 Transcribe → 4 Hydrogen',
    provider: 'gemini',
    pipeline: 'cascaded-2hop',
    asrModel: 'gemini-3.5-transcribe',
    llmModel: 'gemini-4-hydrogen',
    thinkingLevel: 'LOW',
    description: '2-hop benchmark: dedicated ASR transcription first, then text translation JSON.',
    recommendedFor: 'Measuring cascaded latency/cost penalty vs single-call audio',
    pricing: {
      textInputPer1MUsd: 1.50,
      audioInputPer1MUsd: 0.50,
      outputPer1MUsd: 7.50,
      note: '2 sequential network hops (ASR + Translate)',
    },
  },
  {
    id: 'groq-whisper-turbo-cascaded',
    label: 'Groq Whisper v3 Turbo → Flash-Lite',
    provider: 'groq',
    pipeline: 'cascaded-2hop',
    asrModel: 'whisper-large-v3-turbo',
    llmModel: 'gemini-3.1-flash-lite',
    thinkingLevel: 'MINIMAL',
    description: 'Ultra-fast Groq Whisper ASR ($0.04/hr) piped into Gemini Flash-Lite.',
    recommendedFor: 'Testing cheap external ASR vs native Gemini Indic audio',
    pricing: {
      textInputPer1MUsd: 0.25,
      audioInputPer1MUsd: 0,
      outputPer1MUsd: 1.50,
      asrPerMinuteUsd: 0.00067,
      note: 'Groq ASR billed per audio hour ($0.04/hr) + Gemini text hop',
    },
  },
  {
    id: 'openai-gpt4o-mini-transcribe-cascaded',
    label: 'OpenAI 4o-Mini Transcribe → Flash-Lite',
    provider: 'openai',
    pipeline: 'cascaded-2hop',
    asrModel: 'gpt-4o-mini-transcribe',
    llmModel: 'gemini-3.1-flash-lite',
    thinkingLevel: 'MINIMAL',
    description: 'OpenAI GPT-4o Mini Transcribe ASR piped into Gemini Flash-Lite JSON.',
    recommendedFor: 'Comparing OpenAI ASR accuracy & latency on Indian accents',
    pricing: {
      textInputPer1MUsd: 0.25,
      audioInputPer1MUsd: 0,
      outputPer1MUsd: 1.50,
      asrPerMinuteUsd: 0.003,
      note: 'OpenAI ASR (~$0.003/min) + Gemini text hop',
    },
  },
  {
    id: 'sarvam-saaras-cascaded',
    label: 'Sarvam Saaras v3 → Flash-Lite',
    provider: 'sarvam',
    pipeline: 'cascaded-2hop',
    asrModel: 'saaras:v3',
    llmModel: 'gemini-3.1-flash-lite',
    thinkingLevel: 'MINIMAL',
    description: 'India-specialist Sarvam Saaras ASR (22 Indic languages) + Gemini JSON.',
    recommendedFor: 'Benchmarking regional Indian dialects & noisy telephony audio',
    pricing: {
      textInputPer1MUsd: 0.25,
      audioInputPer1MUsd: 0,
      outputPer1MUsd: 1.50,
      asrPerMinuteUsd: 0.0058,
      note: 'Sarvam Saaras (~₹0.49/min) + Gemini text hop',
    },
  },
];

export const TARGET_LANGUAGES = [
  'English',
  'Hindi',
  'Hinglish',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Kannada',
  'Gujarati',
];

export const PREVIEW_LANGUAGES = [
  'Auto (same as spoken language)',
  'Hindi (Devanagari)',
  'Hinglish (Roman script)',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Kannada',
  'English',
];

export const TONE_OPTIONS: Array<{ id: RecipientTone; label: string; hint: string }> = [
  { id: 'natural', label: 'Natural', hint: 'Clean everyday phrasing matching speaker intent' },
  { id: 'polite', label: 'Polite / Respectful', hint: 'Warm & respectful (teacher, parent, elder, client)' },
  { id: 'professional', label: 'Professional', hint: 'Crisp workplace / email / job application tone' },
  { id: 'support', label: 'Customer Support', hint: 'Helpful & clear for shopkeepers / coaching staff' },
  { id: 'casual', label: 'Casual', hint: 'Short, friendly chat tone for WhatsApp' },
];

export function buildDefaultSystemPrompt(params: {
  targetLanguage: string;
  previewLanguage: string;
  mode: OratoMode;
  tone: RecipientTone;
  previousOutput?: string;
  dictionary: string[];
}): string {
  const toneInstruction: Record<RecipientTone, string> = {
    natural: 'Keep the tone natural, clear, and faithful to the speaker.',
    polite: 'Use polite, respectful phrasing appropriate for teachers, parents, or elders.',
    professional: 'Use crisp, professional workplace phrasing suitable for email or business chat.',
    support: 'Use clear, courteous, helpful phrasing suitable for customer support or shop replies.',
    casual: 'Use friendly, concise casual chat phrasing.',
  };

  const dictionaryBlock =
    params.dictionary.length > 0
      ? `Personal dictionary (spell these exact names/terms accurately): ${params.dictionary.join(', ')}.`
      : 'No custom dictionary entries provided.';

  const modeBlock =
    params.mode === 'edit' && params.previousOutput?.trim()
      ? `MODE: SPEAK TO EDIT.
The user already inserted this previous message:
"""${params.previousOutput.trim()}"""
Apply the user's spoken edit instruction to modify that previous message (e.g., change tone, fix a fact, shorten, or replace details). Output the full updated message.`
      : `MODE: DICTATE & TRANSLATE.
Transcribe the user's speech cleanly (removing filler words like "uh", "matlab", false starts) without inventing new facts.`;

  const previewTarget = params.previewLanguage.startsWith('Auto')
    ? 'the exact language & script most comfortable for the speaker (using their native script if they spoke an Indian language, e.g., Devanagari for Hindi/Hinglish, Tamil script for Tamil/Tanglish)'
    : params.previewLanguage;

  return `You are Orato, an India-first voice dictation and translation engine.
${modeBlock}

Rules:
1. MANDATORY TARGET LANGUAGE FOR "output": ${params.targetLanguage}.
   - You MUST translate the speech into natural ${params.targetLanguage} whenever the speaker uses any other language or code-mix (e.g., Hindi, Hinglish, Tanglish -> ${params.targetLanguage}).
   - ONLY keep the source language if the speaker already spoke exclusively in ${params.targetLanguage} (in which case clean up fillers/punctuation without rewriting meaning).
   - Never output Hindi/Devanagari in "output" when the target language is English. Never add facts or promises the speaker did not say.
2. "spoken_language": Identify the spoken language/mix (e.g., "hi-en (Hinglish)", "ta-en (Tanglish)", "hi (Hindi)", "en-IN (Indian English)").
3. "meaning_preview": Translate the generated "output" BACK into ${previewTarget}. CRITICAL: "meaning_preview" must reflect the literal meaning of "output" so the sender can verify nothing was mistranslated before pressing send—never blindly copy the raw transcript.
4. ${toneInstruction[params.tone]}
5. ${dictionaryBlock}
6. If any spoken phrase is genuinely ambiguous (e.g., Hindi "kal" meaning tomorrow vs yesterday), list it in "ambiguities" with the chosen interpretation and alternative; otherwise return an empty array.
7. If the JSON schema includes a boolean field such as "translated", set it to true when the output was translated into ${params.targetLanguage} from another language, and false only when the speaker already spoke exclusively in ${params.targetLanguage}.`;
}

export const MINIMAL_ORATO_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    transcript: {
      type: 'STRING',
      description: 'Clean verbatim transcript in the original spoken language/mix.',
    },
    spoken_language: {
      type: 'STRING',
      description: 'Detected spoken language or code-mix label, e.g. hi-en (Hinglish).',
    },
    output: {
      type: 'STRING',
      description: 'Natural message ready to insert at the cursor in the target language.',
    },
    meaning_preview: {
      type: 'STRING',
      description:
        'Literal back-translation of output into the speaker comfort language/script so the user can verify meaning before sending.',
    },
  },
  required: ['transcript', 'spoken_language', 'output', 'meaning_preview'],
};

export const DEFAULT_ORATO_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    ...(MINIMAL_ORATO_SCHEMA.properties as Record<string, unknown>),
    ambiguities: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          phrase: { type: 'STRING' },
          chosen: { type: 'STRING' },
          alternative: { type: 'STRING' },
        },
      },
      description: 'Optional ambiguous phrases such as Hindi "kal" (tomorrow vs yesterday).',
    },
    confidence_note: {
      type: 'STRING',
      description: 'Optional brief note if audio was noisy or unclear.',
    },
  },
  required: ['transcript', 'spoken_language', 'output', 'meaning_preview'],
};

