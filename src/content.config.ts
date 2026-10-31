import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const seo = {
  seoTitle: z.string().max(60),
  description: z.string().max(155),
  /** Palabra clave principal: una por página, sin repetirse entre páginas. */
  keyword: z.string(),
};

const step = z.object({ title: z.string(), text: z.string() });

const servicios = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/servicios' }),
  schema: z.object({
    ...seo,
    title: z.string(),
    h1: z.string(),
    lede: z.string(),
    order: z.number(),
    icon: z.enum(['web', 'chatbot', 'automatizacion', 'sistema']),
    cardIndex: z.string(),
    summary: z.string(),
    problems: z.array(step).min(2),
    includes: z.array(z.string()).min(3),
    steps: z.array(step).min(3).max(4),
    priceFrom: z.number().nullable(),
    priceNote: z.string(),
    maintenance: z.string(),
    sectors: z.array(reference('soluciones')),
    demo: reference('proyectos').optional(),
  }),
});

const soluciones = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/soluciones' }),
  schema: z.object({
    ...seo,
    title: z.string(),
    h1: z.string(),
    lede: z.string(),
    order: z.number(),
    cardIndex: z.string(),
    summary: z.string(),
    pains: z.array(step).min(3),
    solution: z.array(step).min(2),
    services: z.array(reference('servicios')).min(1),
    demo: reference('proyectos').optional(),
  }),
});

const proyectos = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/proyectos' }),
  // `image()` valida que el archivo exista y permite optimizarlo (AVIF/WebP) al construir.
  schema: ({ image }) =>
    z
      .object({
        ...seo,
        title: z.string(),
        type: z.enum(['demo', 'caso']),
        order: z.number(),
        sector: reference('soluciones'),
        summary: z.string(),
        problem: z.string(),
        features: z.array(z.string()).min(2),
        /** Solo métricas medidas de verdad (Lighthouse, peso, tiempo de carga). */
        metrics: z
          .array(z.object({ label: z.string(), value: z.string(), measuredAt: z.coerce.date() }))
          .default([]),
        status: z.enum(['en-construccion', 'publicada']),
        url: z.url().optional(),
        services: z.array(reference('servicios')),
        /** Captura real del proyecto (ver src/assets/README.md). */
        cover: image().optional(),
        coverAlt: z.string().optional(),
        gallery: z.array(z.object({ src: image(), alt: z.string().min(5) })).default([]),
      })
      .refine((d) => !d.cover || !!d.coverAlt, {
        message: 'cover requiere coverAlt',
        path: ['coverAlt'],
      }),
});

const faq = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    order: z.number(),
    /** Páginas donde aparece: 'home' o el id de un servicio/sector. */
    pages: z.array(z.string()).min(1),
  }),
});

export const collections = { servicios, soluciones, proyectos, faq };
