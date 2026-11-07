# Lanzamiento comercial — pendientes y configuración externa

Estado local (rama `mejora-comercial-lanzamiento`, sin desplegar). Nada de esto está en producción hasta hacer merge y deploy.

## Configuración externa (requiere tus cuentas/datos)
- 🧑 `DATABASE_URL` en Vercel: sin BD, `/api/quote` y `/api/lead` responden `503 unavailable` (el cotizador ofrece WhatsApp como alternativa, no simula éxito). Verificado localmente.
- 🧑 `RESEND_API_KEY`, `LEAD_NOTIFY_EMAIL`, `EMAIL_FROM`: avisos de leads por correo.
- 🧑 `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`: anti-bot de formularios.
- 🧑 `PUBLIC_GA4_ID`: sin él los eventos solo quedan en `dataLayer`. Crear conversiones `lead_submit`, `cta_whatsapp_click`, `cta_quote_click`.
- 🧑 `LLM_API_KEY` (chat IA), `ADMIN_PASSWORD` (panel), `IP_HASH_SALT`.
- 🧑 Correo de dominio: `site.email` sigue siendo `xapiensys@gmail.com` (TODO en `src/lib/site.ts`).
- ✅ Redes oficiales cargadas en `site.socials` (Instagram, YouTube, Facebook, TikTok).

## Precios: decisiones e inconsistencias
- Conservados: web desde S/ 1,500; web + chatbot desde S/ 2,500; automatización desde S/ 1,800 por flujo; sistemas desde S/ 3,500.
- **Tiendas virtuales y Experiencias 3D no tienen precio definido**: se publican como «se cotiza tras un diagnóstico» (`priceFrom: null`). El cotizador devuelve «A cotizar tras un diagnóstico» para esas necesidades. Define precios y actualiza `src/content/servicios/*.md` y `src/lib/pricing.ts`.
- `pricing.ts` usa un precio provisional de chatbot solo (S/ 1,200–1,800) que no aparece en la página de servicio; confirmar.
- `site.priceRange` («S/ 1,500 – S/ 3,500+») no refleja el precio de automatización por flujo ni el rango de sistemas; revisar.
- Todos los montos de `pricing.ts` siguen marcados `TODO(xapiensys)`.

## Demos (`/demos/*`)
- Ferretería, clínica y constructora son navegables y están etiquetadas «DEMO». Los formularios no envían a un backend: validan y abren WhatsApp hacia Xapiensys con un mensaje marcado «DE PRUEBA». No muestran éxito falso.
- Sin métricas publicadas: aún no se midió Lighthouse de las demos (regla: solo métricas medidas).
- Los gráficos son SVG generados por código (sin fotos de stock).

## Pendiente / mejoras
- Dependencias con avisos de `npm audit` (10, todas en la cadena de `@astrojs/vercel` y `zod` transitivo): requieren actualizar el adaptador; no se hizo para no romper el deploy.
- Medir Lighthouse móvil en producción y completar `docs/ROADMAP.md`.
- Search Console, Google Business Profile y textos legales (`/privacidad`).
