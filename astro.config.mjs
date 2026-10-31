// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

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
        values: ['anthropic'],
        optional: true,
      }),
      LLM_MODEL: envField.string({ context: 'server', access: 'secret', optional: true }),
      LLM_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
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
        "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
        "font-src 'self'",
        "connect-src 'self' https://challenges.cloudflare.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
        'frame-src https://challenges.cloudflare.com',
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: [
          "'self'",
          'https://challenges.cloudflare.com',
          'https://www.googletagmanager.com',
        ],
      },
    },
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
