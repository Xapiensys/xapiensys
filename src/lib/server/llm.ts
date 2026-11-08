/**
 * Cliente LLM con streaming. Proveedor configurable por env: `anthropic` o `gemini`.
 * Para agregar otro proveedor, implementa `ChatProvider` y regístralo en `getProvider()`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { LLM_API_KEY, LLM_MODEL, LLM_PROVIDER } from 'astro:env/server';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'lead_form' }
  | { type: 'usage'; tokensIn: number; tokensOut: number }
  | { type: 'refused' };

export interface ChatProvider {
  model: string;
  stream(system: string, history: ChatTurn[], signal: AbortSignal): AsyncGenerator<ChatEvent>;
}

/** Herramienta que el modelo usa para pedir los datos de contacto (el cliente muestra el mini-formulario). */
export const LEAD_TOOL_NAME = 'mostrar_formulario_contacto';

// Modelos rápidos y económicos (ARCHITECTURE §7.3). Se pueden cambiar con LLM_MODEL.
const DEFAULT_MODELS = {
  anthropic: 'claude-haiku-5-5',
  gemini: 'gemini-3.5-flash-lite',
} as const;
const MAX_OUTPUT_TOKENS = 350;
const LEAD_TOOL_DESCRIPTION =
  'Muestra al visitante un formulario corto (nombre, negocio, WhatsApp) para que el equipo de Xapiensys lo contacte. Úsala cuando la persona muestre interés en contratar, pida una cotización o quiera que la contacten.';
const LEAD_TOOL_PARAMS = {
  type: 'object',
  properties: {
    motivo: { type: 'string', description: 'Resumen breve de lo que necesita el visitante.' },
  },
} as const;

function anthropicProvider(apiKey: string, model: string): ChatProvider {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
  return {
    model,
    async *stream(system, history, signal) {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          // Atención comercial: respuestas cortas y rápidas, sin razonamiento extendido.
          thinking: { type: 'disabled' },
          output_config: { effort: 'low' },
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          tools: [
            {
              name: LEAD_TOOL_NAME,
              description: LEAD_TOOL_DESCRIPTION,
              input_schema: { ...LEAD_TOOL_PARAMS, required: [], additionalProperties: false },
            },
          ],
          tool_choice: { type: 'auto' },
          messages: history,
        },
        { signal },
      );

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text };
        } else if (
          event.type === 'content_block_start' &&
          event.content_block.type === 'tool_use'
        ) {
          if (event.content_block.name === LEAD_TOOL_NAME) yield { type: 'lead_form' };
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') yield { type: 'refused' };
      yield {
        type: 'usage',
        tokensIn:
          final.usage.input_tokens +
          (final.usage.cache_read_input_tokens ?? 0) +
          (final.usage.cache_creation_input_tokens ?? 0),
        tokensOut: final.usage.output_tokens,
      };
    },
  };
}

/** Gemini por REST (SSE), sin SDK: menos peso en la función. */
type GeminiChunk = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean; functionCall?: { name: string } }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
};

const GEMINI_BLOCKED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);

function geminiProvider(apiKey: string, model: string): ChatProvider {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  return {
    model,
    async *stream(system, history, signal) {
      const timeout = AbortSignal.timeout(20_000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.any([signal, timeout]),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: history.map((t) => ({
            role: t.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: t.content }],
          })),
          tools: [
            {
              functionDeclarations: [
                {
                  name: LEAD_TOOL_NAME,
                  description: LEAD_TOOL_DESCRIPTION,
                  parameters: LEAD_TOOL_PARAMS,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            // Atención comercial: respuestas cortas y rápidas, razonamiento mínimo.
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        }),
      });
      if (!res.ok || !res.body) throw new Error(`gemini ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let usage: GeminiChunk['usageMetadata'];
      let refused = false;
      let leadShown = false;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.replace(/\r/g, '').split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const chunk = JSON.parse(line.slice(5)) as GeminiChunk;
          if (chunk.usageMetadata) usage = chunk.usageMetadata;
          if (chunk.promptFeedback?.blockReason) refused = true;
          for (const cand of chunk.candidates ?? []) {
            for (const part of cand.content?.parts ?? []) {
              if (part.thought) continue;
              if (part.text) yield { type: 'text', text: part.text };
              if (part.functionCall?.name === LEAD_TOOL_NAME && !leadShown) {
                leadShown = true;
                yield { type: 'lead_form' };
              }
            }
            if (cand.finishReason && GEMINI_BLOCKED.has(cand.finishReason)) refused = true;
          }
        }
      }
      if (refused) yield { type: 'refused' };
      yield {
        type: 'usage',
        tokensIn: usage?.promptTokenCount ?? 0,
        tokensOut: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      };
    },
  };
}

let provider: ChatProvider | null | undefined;

/** `null` si el chat no está configurado: el front pasa a modo guiado. */
export function getProvider(): ChatProvider | null {
  if (provider !== undefined) return provider;
  const name = LLM_PROVIDER ?? 'anthropic';
  const model = LLM_MODEL || DEFAULT_MODELS[name];
  if (!LLM_API_KEY) provider = null;
  else if (name === 'gemini') provider = geminiProvider(LLM_API_KEY, model);
  else provider = anthropicProvider(LLM_API_KEY, model);
  return provider;
}

// Precio aproximado por millón de tokens (USD) para estimar el gasto mensual.
// TODO(xapiensys): actualizar si cambias de modelo.
const PRICES: Record<string, { in: number; out: number }> = {
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
  // TODO(xapiensys): confirmar precio de Gemini en ai.google.dev/pricing (sin dato, se usa el tope conservador).
};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICES[model] ?? { in: 2, out: 10 };
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}
