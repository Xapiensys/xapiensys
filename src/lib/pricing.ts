/**
 * Reglas del cotizador. Fuente única de verdad, se ejecuta SOLO en el servidor (/api/quote).
 * Valores iniciales de docs/ARCHITECTURE.md §7.4.
 * TODO(xapiensys): confirmar todos los montos y porcentajes de este archivo antes de publicar.
 */
import type { QuoteAnswers, Need } from './quote';
import { labelOf, needOptions, timelineOptions, sectorOptions } from './quote';

type Range = { min: number; max: number };

// TODO(xapiensys): bases confirmadas en ARCHITECTURE §7.4, salvo `chatbot` solo (no definido allí).
const BASE = {
  web: { min: 1500, max: 2200 },
  webChatbot: { min: 2500, max: 3500 },
  chatbot: { min: 1200, max: 1800 }, // TODO(xapiensys): precio de chatbot sin web, valor provisional.
  automatizacionPorFlujo: { min: 1800, max: 2500 },
  sistema: { min: 3500, max: 9000 },
  diagnostico: { min: 1500, max: 9000 },
} as const satisfies Record<string, Range>;

// TODO(xapiensys): modificadores de alcance y canal.
const WEB_SCOPE = { basica: 0, media: 0.2, amplia: 0.4 } as const;
const CHATBOT_CHANNEL = { web: 0, whatsapp: 0.15, ambos: 0.25 } as const;
const AUTOMATION_FLOWS = { '1': 1, '2-3': 2, '4+': 4 } as const;
const URGENCY = 0.2; // TODO(xapiensys): entre 15 % y 25 % según ARCHITECTURE.
const COMBO_DISCOUNT = 0.05; // TODO(xapiensys): descuento leve por combinar servicios.

// TODO(xapiensys): mantenimiento mensual (hosting, dominio, tokens IA, soporte).
const MAINTENANCE = {
  web: { min: 150, max: 250 },
  chatbot: { min: 250, max: 400 },
  automatizacion: { min: 200, max: 350 },
  cap: 400,
} as const;

const INCLUDES: Record<Exclude<Need, 'no_seguro'>, string[]> = {
  web: [
    'Diseño a medida y responsive',
    'SEO técnico y Schema.org',
    'Formulario y botón de WhatsApp con medición',
    'Publicación con certificado SSL y analítica',
  ],
  chatbot: [
    'Asistente con IA entrenado con la información de tu negocio',
    'Captura de datos de clientes interesados',
    'Derivación a WhatsApp o a tu equipo',
  ],
  automatizacion: [
    'Diagnóstico del proceso actual',
    'Flujos con Python o n8n conectados a tus herramientas',
    'Documentación y capacitación',
  ],
  sistema: ['Sesión de diagnóstico', 'Propuesta técnica y cronograma', 'Desarrollo por etapas'],
};

// El épsilon evita que errores de coma flotante (1.2 + 0.15 = 1.3499…) redondeen hacia abajo.
const round50 = (n: number) => Math.round(n / 50 + 1e-9) * 50;
const scale = (r: Range, f: number): Range => ({ min: r.min * f, max: r.max * f });
const add = (a: Range, b: Range): Range => ({ min: a.min + b.min, max: a.max + b.max });

export interface PricingResult {
  diagnosis: boolean;
  range: Range;
  maintenance: Range;
  includes: string[];
  summary: string;
}

export function calculateQuote(answers: QuoteAnswers): PricingResult {
  const needs = new Set(answers.needs);
  const diagnosis =
    needs.has('no_seguro') || needs.has('sistema') || answers.scope.automatizacion === '4+';

  let range: Range = { min: 0, max: 0 };
  let priced = 0;

  const hasWeb = needs.has('web');
  const hasBot = needs.has('chatbot');

  if (hasWeb || hasBot) {
    let base: Range = hasWeb && hasBot ? BASE.webChatbot : hasWeb ? BASE.web : BASE.chatbot;
    let factor = 1;
    if (hasWeb) factor += WEB_SCOPE[answers.scope.web ?? 'basica'];
    if (hasBot) factor += CHATBOT_CHANNEL[answers.scope.chatbot ?? 'web'];
    base = scale(base, factor);
    range = add(range, base);
    priced += 1; // web + chatbot ya es precio de paquete
  }

  if (needs.has('automatizacion')) {
    const flows = AUTOMATION_FLOWS[answers.scope.automatizacion ?? '1'];
    range = add(range, scale(BASE.automatizacionPorFlujo, flows));
    priced += 1;
  }

  if (needs.has('sistema')) {
    range = add(range, BASE.sistema);
    priced += 1;
  }

  if (needs.has('no_seguro') && priced === 0) range = { ...BASE.diagnostico };

  if (priced >= 2) range = scale(range, 1 - COMBO_DISCOUNT);
  if (answers.timeline === 'urgente') range = scale(range, 1 + URGENCY);

  const maintenance: Range = { min: 0, max: 0 };
  if (hasWeb || needs.has('no_seguro') || needs.has('sistema')) {
    maintenance.min = Math.max(maintenance.min, MAINTENANCE.web.min);
    maintenance.max = Math.max(maintenance.max, MAINTENANCE.web.max);
  }
  if (hasBot) {
    maintenance.min = Math.max(maintenance.min, MAINTENANCE.chatbot.min);
    maintenance.max = Math.max(maintenance.max, MAINTENANCE.chatbot.max);
  }
  if (needs.has('automatizacion')) {
    maintenance.min = Math.max(maintenance.min, MAINTENANCE.automatizacion.min);
    maintenance.max = Math.max(maintenance.max, MAINTENANCE.automatizacion.max);
  }
  maintenance.max = Math.min(maintenance.max, MAINTENANCE.cap);

  const includes = [...needs]
    .filter((n): n is Exclude<Need, 'no_seguro'> => n !== 'no_seguro')
    .flatMap((n) => INCLUDES[n]);
  if (diagnosis && !needs.has('sistema')) includes.unshift('Sesión de diagnóstico');

  const summary = [
    answers.needs.map((n) => labelOf(needOptions, n)).join(' + '),
    labelOf(sectorOptions, answers.sector),
    labelOf(timelineOptions, answers.timeline),
  ].join(' · ');

  return {
    diagnosis,
    range: { min: round50(range.min), max: round50(range.max) },
    maintenance: { min: round50(maintenance.min), max: round50(maintenance.max) },
    includes: [...new Set(includes)],
    summary,
  };
}
