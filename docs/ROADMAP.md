# Roadmap — xapiensys.com v2

> Claude Code: ejecuta **una fase por sesión**. Al empezar, lee `CLAUDE.md` y `docs/ARCHITECTURE.md`. Al terminar, marca las casillas, anota decisiones nuevas en ARCHITECTURE §12 y no inicies la siguiente fase sin aprobación.

Leyenda: `[ ]` pendiente · `[x]` hecho · 🧑 requiere acción humana (cuentas, claves, textos)

---

## F0 — Higiene del sitio actual (antes de migrar, ~1 h)
Objetivo: dejar el sitio en producción sin errores mientras se construye la v2.
- [x] Eliminar el texto suelto `así va ps` después de `</html>` en `index.html`.
- [x] Eliminar `app.py` vacío del repo.
- [ ] 🧑 Crear correo de dominio (ej. `contacto@xapiensys.com`) y reemplazar `xapiensys@gmail.com` en web y JSON-LD.
- [ ] Verificar que `sameAs` apunte a perfiles que existen y enlazan al sitio.

**Aceptación:** HTML válido (validator.w3.org sin errores), deploy en verde.

> Estado (2026-10-30): el sitio viejo se reemplazó por la v2 (F1), así que los dos primeros puntos quedan resueltos. Correo de dominio y `sameAs` siguen pendientes (marcados `TODO(xapiensys)` en `src/lib/site.ts`; el Instagram `jinfaxtech` no coincide con la marca).

---

## F1 — Migración a Astro con paridad visual
Objetivo: misma página que hoy, sobre la nueva arquitectura y más rápida.
- [x] Crear proyecto Astro + TypeScript estricto + adaptador Netlify + `@astrojs/sitemap` + Preact.
- [x] Mover fuentes, favicon, logo y og-image a `public/`.
- [x] Extraer variables de `style.css` a `tokens.css`; resto a `global.css` y CSS por componente.
- [x] Crear `site.ts` (NAP único), `Seo.astro`, `SchemaOrg.astro`, `BaseLayout.astro`.
- [x] Partir el `index.html` actual en componentes de `sections/` y `layout/`.
- [x] Reescribir la escena 3D como `Scene3D.ts` con imports por módulo de `three` (npm), niveles de calidad y pausa fuera de viewport. → Hecho en **WebGL nativo** (ver ARCHITECTURE §12: `three` pesaba ~530 KB).
- [x] `MobileMenu` como isla mínima.
- [x] `netlify.toml`: build de Astro, cabeceras de seguridad y caché, redirect `www → apex`.
- [x] Borrar `vendor/three.module.min.js`.

> Verificado (2026-10-30, build local con compresión): Lighthouse móvil 99–100 / 100 / 100 / 100 en todas las plantillas; home LCP 1.7 s, CLS 0, TBT 0; JS inicial ≈ 3 KB gzip; escena 3D 6 KB (2.5 KB gzip). Revisión visual con Playwright en 360/768/1440. Pendiente: Rich Results Test sobre la URL pública.

**Aceptación:**
- Diferencias visuales mínimas frente al sitio actual en 360/768/1440 px.
- Lighthouse móvil ≥ 95 en las 4 categorías.
- Chunk 3D ≤ 250 KB minificado; JS inicial ≤ 30 KB gzip.
- JSON-LD válido en Rich Results Test.

---

## F2 — Backend base: leads + cotizador
Objetivo: que cada interesado quede registrado y medido.
- [ ] 🧑 Crear BD Postgres (Neon o Supabase), cuenta Resend con dominio verificado y Turnstile. Cargar variables en Netlify.
- [x] Drizzle: `schema.ts` (`leads`, `quotes`, `rate_limits`) + migración.
- [x] `lib/server/`: `db.ts`, `rateLimit.ts`, `turnstile.ts`, `email.ts`.
- [x] `lib/pricing.ts` con las reglas de ARCHITECTURE §7.4 (valores con `TODO(xapiensys)`).
- [x] `POST /api/lead` y `POST /api/quote` según ARCHITECTURE §7.1–7.2.
- [x] Isla `Quoter.tsx` (5 pasos) embebida en home + página `/cotizar`.
- [x] Hero: segundo CTA → "Cotiza tu proyecto en 1 minuto".
- [x] `lib/whatsapp.ts` con código de lead en el mensaje prellenado.
- [x] `/contacto` con formulario, `/gracias` (noindex), `/privacidad`.
- [ ] 🧑 Revisar y aprobar texto de `/privacidad` y precios del cotizador.

> Verificado contra Postgres local: lead guardado con UTM; honeypot descartado; sin consentimiento → 422; 6.º envío/hora → 429; Turnstile rechaza sin token o con token inválido (falla cerrado); precio enviado por el cliente se ignora (el servidor recalcula). Pendiente con cuentas reales: email de Resend y Turnstile con clave real.

**Aceptación:**
- Un lead de prueba aparece en la BD y llega por email en < 10 s.
- Envíos con honeypot lleno o sin Turnstile son rechazados; el 6.º envío en 1 h desde la misma IP devuelve 429.
- El precio no se puede alterar desde el cliente (se prueba manipulando el payload).
- Lighthouse se mantiene ≥ 95.

---

## F3 — Chat IA real
Objetivo: la demo en vivo que vende.
- [ ] 🧑 Elegir proveedor/modelo LLM, crear API key con límite de gasto en el panel del proveedor (doble protección).
- [x] Tablas `chat_sessions`, `chat_messages`, `usage_monthly`.
- [x] `lib/server/llm.ts` (streaming) y `chatPrompt.ts` (base de conocimiento desde `src/content`).
- [x] `POST /api/chat` con SSE y todos los límites de ARCHITECTURE §7.3.
- [x] Isla `ChatDemo.tsx`: streaming, sugerencias, mini-formulario de lead, modo guiado de respaldo.
- [ ] Set de 20 preguntas de prueba (comerciales, fuera de tema, intentos de cambiar instrucciones) y revisar respuestas.

> Verificado con un servidor que simula la API de Anthropic: streaming SSE, historial de 10 turnos, señal de formulario (herramienta `mostrar_formulario_contacto`), lead con `source: "chat"` vinculado a la sesión, y los límites (12 mensajes/sesión, 5 sesiones/IP/día, tope mensual, sin LLM → modo guiado). Pendiente con API key real: latencia del primer token y el set de 20 preguntas.

**Aceptación:**
- Primer token visible en < 1.5 s.
- Fuera de tema → redirige amablemente; intento de cambiar instrucciones → no cede.
- Al superar cualquier límite → modo guiado + WhatsApp, sin error visible.
- Lead creado desde el chat aparece con `source: "chat"`.

---

## F4 — Estructura silo y contenido SEO
Objetivo: páginas que rankean para búsquedas de compra.
- [x] Colecciones `servicios`, `soluciones`, `proyectos`, `faq` con esquemas Zod.
- [x] 4 páginas de servicio y 3 de sector con las plantillas de ARCHITECTURE §4.
- [x] Hubs `/servicios`, `/soluciones`, `/proyectos`; página `/empresa`.
- [x] Breadcrumbs + `BreadcrumbList`; `Service` en servicios.
- [x] OG image por página generada en build.
- [x] Menú y footer con la nueva navegación; enlazado interno según reglas.
- [x] Home reorganizado según ARCHITECTURE §5 (sectores, laboratorio, inversión, FAQ).
- [ ] 🧑 Revisar textos: 1 palabra clave principal por página, sin canibalizar (dos páginas no apuntan al mismo término).

> Verificado: un H1 por página, jerarquía sin saltos, títulos ≤ 60 y descripciones únicas, canonical correcto, JSON-LD parseable en todas; rastreo interno sin enlaces rotos; sitemap con 18 URLs indexables.

**Aceptación:**
- Todas las páginas: un H1, title/description únicos, canonical correcto, JSON-LD válido.
- Sitemap con todas las URLs indexables; sin enlaces rotos (`linkinator` o similar).
- Lighthouse ≥ 95 en todas las plantillas.

---

## F5 — Medición y presencia local
- [x] `lib/analytics.ts` + GA4 diferido + todos los eventos de ARCHITECTURE §9.
- [x] Captura de UTM y `landing_path` enviada con cada lead.
- [ ] 🧑 Search Console: enviar sitemap, revisar cobertura.
- [ ] 🧑 Google Business Profile: crear/verificar con el mismo NAP de `site.ts`, categoría "Diseñador de sitios web" / "Consultor de software", enlace al sitio.
- [ ] 🧑 Configurar conversiones en GA4 (`lead_submit`, `cta_whatsapp_click`).

**Aceptación:** los eventos aparecen en GA4 DebugView; un lead de prueba muestra su UTM en la BD.

---

## F6 — Laboratorio de demos y panel (opcional, después de tener tráfico)
- [ ] 3 demos propias (Clínica, Constructora, Comercio) como páginas en `/proyectos/[slug]`, cada una etiquetada "Demo" y con métricas técnicas medidas.
- [ ] Panel `/admin` protegido (Netlify Identity o auth simple) para ver leads, cambiar estado y notas.
- [ ] Cuando exista el primer cliente con permiso: primer `proyectos` con `type: "caso"`.

---

## Prompt de arranque por fase (para pegar en Claude Code)

```
Lee CLAUDE.md, docs/ARCHITECTURE.md y docs/ROADMAP.md completos.
Vamos a ejecutar la fase F<N>. Antes de escribir código:
1) resume en 5 líneas qué vas a hacer y qué archivos vas a crear o tocar,
2) lista lo que necesitas de mí (marcado 🧑) y espera mi confirmación.
Luego implementa, verifica los criterios de aceptación de la fase con comandos reales
(build, check, Lighthouse) y termina con un resumen de lo hecho y lo pendiente.
```
