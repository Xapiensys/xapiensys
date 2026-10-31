/**
 * Cliente LLM con streaming. Proveedor configurable por env (hoy: Anthropic).
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

// Modelo rápido y económico (ARCHITECTURE §7.3). Se puede cambiar con LLM_MODEL.
const DEFAULT_MODEL = 'claude-haiku-5-5';
const MAX_OUTPUT_TOKENS = 350;

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
              description:
                'Muestra al visitante un formulario corto (nombre, negocio, WhatsApp) para que el equipo de Xapiensys lo contacte. Úsala cuando la persona muestre interés en contratar, pida una cotización o quiera que la contacten.',
              input_schema: {
                type: 'object',
                properties: {
                  motivo: {
                    type: 'string',
                    description: 'Resumen breve de lo que necesita el visitante.',
                  },
                },
                required: [],
                additionalProperties: false,
              },
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

let provider: ChatProvider | null | undefined;

/** `null` si el chat no está configurado: el front pasa a modo guiado. */
export function getProvider(): ChatProvider | null {
  if (provider !== undefined) return provider;
  const model = LLM_MODEL || DEFAULT_MODEL;
  provider =
    LLM_API_KEY && (LLM_PROVIDER ?? 'anthropic') === 'anthropic'
      ? anthropicProvider(LLM_API_KEY, model)
      : null;
  return provider;
}

// Precio aproximado por millón de tokens (USD) para estimar el gasto mensual.
// TODO(xapiensys): actualizar si cambias de modelo.
const PRICES: Record<string, { in: number; out: number }> = {
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICES[model] ?? { in: 2, out: 10 };
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}
