export type ProviderId = 'gemini' | 'groq' | 'openai' | 'sarvam';

export type PipelineKind = 'single-call' | 'cascaded-2hop';

export type OratoMode = 'dictate' | 'edit';

export type RecipientTone =
  | 'natural'
  | 'polite'
  | 'professional'
  | 'support'
  | 'casual';

export interface ProviderAvailability {
  gemini: boolean;
  groq: boolean;
  openai: boolean;
  sarvam: boolean;
}

export interface ModelPricingSpec {
  textInputPer1MUsd: number;
  audioInputPer1MUsd: number;
  outputPer1MUsd: number;
  asrPerMinuteUsd?: number;
  note: string;
}

export interface ModelProfile {
  id: string;
  label: string;
  provider: ProviderId;
  pipeline: PipelineKind;
  asrModel?: string;
  llmModel: string;
  thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  recommendedFor: string;
  pricing: ModelPricingSpec;
}

export interface TokenBreakdown {
  audioInputTokens: number;
  textInputTokens: number;
  thinkingTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedAudioTokensAt25PerSec: number;
}

export interface CostBreakdown {
  asrUsd: number;
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
  totalInr: number;
}

export interface LatencyBreakdown {
  asrMs: number;
  llmMs: number;
  totalMs: number;
}

export interface OratoOutput {
  transcript: string;
  spoken_language: string;
  output: string;
  meaning_preview: string;
  ambiguities?: Array<{
    phrase: string;
    chosen: string;
    alternative: string;
  }>;
  confidence_note?: string;
  extraFields?: Record<string, unknown>;
}

export interface BenchmarkRequestMeta {
  targetLanguage: string;
  previewLanguage: string;
  mode: OratoMode;
  tone: RecipientTone;
  previousOutput: string;
  dictionary: string[];
  customSystemPrompt?: string;
  customResponseSchema?: Record<string, unknown>;
  audioDurationSec: number;
  rawDurationSec: number;
  trimmedSilenceSec: number;
  audioBytes: number;
}

export interface BenchmarkResult {
  id: string;
  runId: string;
  timestamp: string;
  modelId: string;
  modelLabel: string;
  provider: ProviderId;
  pipeline: PipelineKind;
  thinkingLevel?: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
  latency: LatencyBreakdown;
  tokens: TokenBreakdown;
  cost: CostBreakdown;
  parsed?: OratoOutput;
  rawAsrTranscript?: string;
  rawResponseText?: string;
  rawUsageMetadata?: unknown;
  audioDurationSec: number;
  targetLanguage: string;
  previewLanguage: string;
  mode: OratoMode;
  tone: RecipientTone;
}
