// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import cspUnion from './integrations/csp-union.mjs';

/**
 * La CSP de Astro no incluye los <script is:inline>: se calcula su hash desde el código
 * fuente (Astro los publica tal cual). Si editas uno, el hash se actualiza solo al compilar.
 */
const INLINE_SCRIPT_FILES = [
  'src/layouts/BaseLayout.astro',
  'src/components/layout/IntroLoader.astro',
];
const inlineScriptHashes = INLINE_SCRIPT_FILES.flatMap((file) => {
  const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  return [...src.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].map(
    (m) => `sha256-${createHash('sha256').update(m[1] ?? '').digest('base64')}`,
  );
});

export default defineConfig({
  site: 'https://xapiensys.com',
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'always' },
  adapter: vercel({ maxDuration: 30 }),
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !/^\/(api|gracias|og|admin)(\/|$)/.test(new URL(page).pathname),
      lastmod: new Date(),
    }),
    // Debe ir al final: unifica la CSP de todas las páginas tras compilar.
    cspUnion(),
  ],
  markdown: { syntaxHighlight: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  env: {
    // Todas opcionales: sin claves el sitio sigue funcionando en modo degradado.
    schema: {
      PUBLIC_SITE_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'https://xapiensys.com',
      }),
      /** Enlace de agenda (Cal.com, Calendly…). Si existe, se muestra "Agendar llamada". */
      PUBLIC_BOOKING_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_GA4_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      LEAD_NOTIFY_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      EMAIL_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
      LLM_PROVIDER: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['anthropic', 'gemini'],
        optional: true,
      }),
      LLM_MODEL: envField.string({ context: 'server', access: 'secret', optional: true }),
      LLM_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      /** Radio Tommy: canciones completas vía YouTube Data API v3 (sin ella, fragmentos de iTunes). */
      YOUTUBE_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      CHAT_MONTHLY_TOKEN_CAP: envField.number({
        context: 'server',
        access: 'secret',
        int: true,
        default: 2000000,
      }),
      /** Contraseña del panel /admin (larga y única). Sin ella el panel queda desactivado. */
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      IP_HASH_SALT: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://*.mzstatic.com https://i.ytimg.com",
        // Radio Tommy: fragmentos de audio oficiales de iTunes/Apple Music.
        "media-src 'self' https://*.itunes.apple.com https://*.mzstatic.com",
        "font-src 'self'",
        "connect-src 'self' https://challenges.cloudflare.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
        'frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.youtube.com',
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: [
          "'self'",
          'https://challenges.cloudflare.com',
          'https://www.googletagmanager.com',
          // Reproductor oficial de YouTube (Radio Tommy).
          'https://www.youtube.com',
          'https://s.ytimg.com',
        ],
        hashes: /** @type {`sha256-${string}`[]} */ (inlineScriptHashes),
      },
    },
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
