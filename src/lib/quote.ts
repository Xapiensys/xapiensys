/**
 * Esquemas Zod del cotizador y de leads (solo servidor: no importar desde islas).
 */
import { z } from 'zod';
import {
  needOptions,
  sectorOptions,
  webScopeOptions,
  chatbotChannelOptions,
  automationScopeOptions,
  timelineOptions,
} from './quoteOptions';

export * from './quoteOptions';

type Values<T extends readonly { value: string }[]> = T[number]['value'];
const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [Values<T>, ...Values<T>[]];

export const needSchema = z.enum(values(needOptions));
export const sectorSchema = z.enum(values(sectorOptions));
export const timelineSchema = z.enum(values(timelineOptions));

export const quoteAnswersSchema = z.object({
  needs: z.array(needSchema).min(1).max(5),
  sector: sectorSchema,
  scope: z
    .object({
      web: z.enum(values(webScopeOptions)).optional(),
      chatbot: z.enum(values(chatbotChannelOptions)).optional(),
      automatizacion: z.enum(values(automationScopeOptions)).optional(),
    })
    .default({}),
  timeline: timelineSchema,
});

export type QuoteAnswers = z.infer<typeof quoteAnswersSchema>;

/* ---------- Contacto (compartido por /api/lead y /api/quote) ---------- */

const phoneRegex = /^\+?[\d\s()-]{7,20}$/;

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  company: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z.string().trim().regex(phoneRegex),
  email: z
    .string()
    .trim()
    .max(160)
    .pipe(z.email())
    .optional()
    .or(z.literal('').transform(() => undefined)),
  consent: z.literal(true),
});

export const attributionSchema = z
  .object({
    utm_source: z.string().max(100).optional(),
    utm_medium: z.string().max(100).optional(),
    utm_campaign: z.string().max(100).optional(),
    landing_path: z.string().max(200).optional(),
  })
  .optional();

export const antiBotSchema = z.object({
  turnstileToken: z.string().max(4096).optional(),
  /** Honeypot: debe llegar vacío. */
  website: z.string().max(200).optional(),
});

export const quoteRequestSchema = z
  .object({ answers: quoteAnswersSchema, utm: attributionSchema })
  .and(contactSchema)
  .and(antiBotSchema);

export const leadRequestSchema = z
  .object({
    needs: z.array(needSchema).max(5).default([]),
    sector: sectorSchema.optional(),
    message: z.string().trim().max(1500).optional(),
    source: z.enum(['form', 'chat', 'quote']),
    chatSessionId: z.uuid().optional(),
    utm: attributionSchema,
  })
  .and(contactSchema)
  .and(antiBotSchema);

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type LeadRequest = z.infer<typeof leadRequestSchema>;
