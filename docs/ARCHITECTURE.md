# Arquitectura — xapiensys.com v2

> Documento de referencia para Claude Code. Explica **qué** construimos, **por qué** y **cómo encaja cada parte con los objetivos de negocio**. Las reglas operativas están en `/CLAUDE.md`; el orden de trabajo, en `docs/ROADMAP.md`.

---

## 1. Objetivos y cómo se miden

El sitio existe para **generar consultas calificadas** que terminen en proyectos de S/ 1,500–3,500+ más mantenimiento mensual de S/ 150–400. Todo lo demás está al servicio de eso.

| # | Objetivo | Cómo lo cumple la arquitectura | Métrica de éxito |
|---|----------|-------------------------------|------------------|
| O1 | Captar leads calificados | Cotizador + chat IA que guardan el lead en BD antes de abrir WhatsApp | Leads/semana, % con presupuesto y sector completos |
| O2 | Demostrar capacidad técnica (el sitio es la demo) | Chat IA real, cotizador con backend, 3D fluido, puntuación Lighthouse visible | Tiempo en `/`, uso del chat, tasa chat → lead |
| O3 | Posicionar en Google (marca + local) | Páginas silo por servicio y sector, HTML estático, Schema.org por página | Posición para "Xapiensys"/"Xapiens", impresiones de términos locales en Search Console |
| O4 | Rendimiento impecable con 3D | Contenido estático primero, 3D como isla diferida y adaptativa | Core Web Vitals en verde (campo), Lighthouse ≥ 95 |
| O5 | Medir para mejorar | Eventos en cada CTA, código de lead en WhatsApp, origen UTM guardado | Embudo: visita → interacción → lead → WhatsApp |

**Expectativas realistas de SEO:**
- Términos de marca (Xapiensys, Xapiens, Xapiensis): alcanzables en el 1.er puesto en semanas, con Schema, Google Business Profile y menciones consistentes.
- "Sapiens" a secas: **no es objetivo** (compite con el libro de Harari y con empresas globales). El dominio `sapiens.com` no es nuestro.
- Términos de conversión ("página web para clínicas en Lima", "chatbot para WhatsApp empresas Perú"): se ganan con **páginas específicas y contenido útil**, no con el home. Es un trabajo de meses.
- Google Maps depende sobre todo de **Google Business Profile**, no del sitio. Se trata como tarea paralela (ver Roadmap F5).

---

## 2. Visión general del sistema

```
                    ┌──────────────────────────── Vercel ─────────────────────────────┐
 Navegador          │                                                                 │
 ─────────          │  CDN (HTML estático prerenderizado por Astro)                    │
 HTML + CSS  ◄──────┤    /  /servicios/*  /soluciones/*  /proyectos/*  /empresa ...    │
 (instantáneo)      │                                                                 │
                    │  Vercel Functions (endpoints Astro, prerender = false)          │
 Islas JS ─────────►│    POST /api/lead     → valida → BD → email → código XP-####    │
  · Scene3D (lazy)  │    POST /api/quote    → reglas de precios (servidor) → BD       │
  · ChatIA          │    POST /api/chat     → límites → LLM (streaming) → BD          │
  · Cotizador       │    GET  /api/health                                             │
  · Menú móvil      └───────────┬───────────────────┬──────────────────┬──────────────┘
                                │                   │                  │
                         Postgres (Neon/      Proveedor LLM        Resend (email)
                         Supabase) + Drizzle  (vía env vars)       Turnstile (anti-bot)
```

Principios:
1. **Estático por defecto.** Cada página es HTML completo servido desde CDN. El JS solo agrega interactividad; si falla, la página sigue vendiendo (CTA a WhatsApp siempre visible).
2. **Un solo repositorio, un solo deploy.** Frontend y backend viven juntos en Astro + Vercel. Nada de servidores aparte que mantener.
3. **El servidor decide.** Precios, límites del chat y validación se ejecutan en el backend.
4. **Degradación elegante.** Sin JS → página completa. Sin GPU → SVG. Límite del chat agotado → modo guiado + WhatsApp. BD caída → el email de notificación igual sale (y viceversa).

---

## 3. Estructura del repositorio

```
xapiensys/
├── CLAUDE.md
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
├── astro.config.mjs            # site: https://xapiensys.com, adapter vercel, sitemap
├── vercel.json                 # headers de seguridad y caché, redirects
├── drizzle.config.ts
├── .env.example
├── public/
│   ├── fonts/                  # inter-latin.woff2, space-grotesk-latin.woff2
│   ├── favicon.svg  logo.svg  og-image.png
│   └── robots.txt
└── src/
    ├── styles/
    │   ├── tokens.css          # colores, tipografía, espaciado, radios, sombras, z-index
    │   └── global.css          # reset, base tipográfica, utilidades (.visually-hidden, .section-shell)
    ├── layouts/
    │   └── BaseLayout.astro    # <html lang="es-PE">, Seo, SchemaOrg, Header, Footer, WhatsAppFloat, Scene3D
    ├── components/
    │   ├── seo/
    │   │   ├── Seo.astro               # title, description, canonical, OG, Twitter
    │   │   └── SchemaOrg.astro         # JSON-LD según tipo de página
    │   ├── layout/
    │   │   ├── Header.astro  Footer.astro  MobileMenu.astro (isla mínima)
    │   │   ├── Breadcrumbs.astro
    │   │   └── WhatsAppFloat.astro     # botón flotante, sin JS
    │   ├── sections/                   # bloques reutilizables entre páginas
    │   │   ├── Hero.astro  ValueMatrix.astro  ServicesGrid.astro
    │   │   ├── ProcessSteps.astro  Coverage.astro  DemoShowcase.astro
    │   │   ├── PricingHint.astro  FAQ.astro  FinalCTA.astro
    │   ├── islands/
    │   │   ├── Scene3D.ts              # Three.js, carga diferida y adaptativa
    │   │   ├── ChatDemo.tsx            # Preact
    │   │   └── Quoter.tsx              # Preact, cotizador por pasos
    │   └── ui/
    │       ├── Button.astro  GlassPanel.astro  SectionLabel.astro  Icon.astro
    ├── content/                        # colecciones tipadas (content.config.ts)
    │   ├── servicios/*.md
    │   ├── soluciones/*.md             # sectores: clinicas, constructoras, comercios
    │   ├── proyectos/*.md              # demos propias (type: "demo")
    │   └── faq/*.md
    ├── lib/
    │   ├── pricing.ts          # reglas del cotizador (fuente única, usada solo en servidor)
    │   ├── whatsapp.ts         # buildWhatsAppUrl({ intent, leadCode })
    │   ├── analytics.ts        # track(event, props)
    │   ├── site.ts             # NAP: nombre, teléfono, email, redes, URL (fuente única)
    │   └── server/
    │       ├── db.ts  schema.ts        # Drizzle
    │       ├── rateLimit.ts
    │       ├── turnstile.ts
    │       ├── email.ts                # Resend
    │       ├── llm.ts                  # cliente del proveedor LLM, streaming
    │       └── chatPrompt.ts           # system prompt + base de conocimiento
    └── pages/
        ├── index.astro
        ├── servicios/index.astro  servicios/[slug].astro
        ├── soluciones/[slug].astro
        ├── proyectos/index.astro  proyectos/[slug].astro
        ├── empresa.astro  contacto.astro  cotizar.astro  diagnostico.astro
        ├── gracias.astro  privacidad.astro  404.astro
        ├── admin/index.astro  admin/login.astro      # panel interno (SSR, noindex)
        └── api/
            ├── lead.ts  quote.ts  chat.ts  health.ts
            └── admin/login.ts  logout.ts  lead.ts  export.csv.ts
```

`src/lib/site.ts` es la **única fuente** del nombre, teléfono, correo y redes. Header, Footer, Schema y WhatsApp lo leen de ahí, así el NAP (nombre-dirección-teléfono) es idéntico en todo el sitio, algo clave para el SEO local.

---

## 4. Mapa del sitio (estructura silo)

```
/                                   Home: propuesta de valor + demo en vivo + cotizador
├── /servicios                      Hub de servicios
│   ├── /servicios/paginas-web
│   ├── /servicios/chatbots-ia
│   ├── /servicios/automatizacion
│   └── /servicios/sistemas-a-medida
├── /soluciones                     Hub por sector (long-tail local)
│   ├── /soluciones/clinicas
│   ├── /soluciones/constructoras
│   └── /soluciones/comercios       # restaurantes, retail, servicios
├── /proyectos                      Demos propias (etiquetadas "Demo")
│   └── /proyectos/[slug]
├── /cotizar                        Cotizador a pantalla completa
├── /empresa                        Quiénes somos, método, stack, variantes de marca
├── /contacto                       Formulario + WhatsApp + email
├── /privacidad                     Política de datos (Ley 29733)
├── /gracias                        Confirmación post-lead (noindex)
└── /404
```

**Reglas de enlazado interno:**
- Cada página de servicio enlaza a 2–3 sectores donde aplica; cada sector enlaza a los servicios que usa.
- Todas las páginas terminan en `FinalCTA` (cotizador + WhatsApp).
- Breadcrumbs visibles + `BreadcrumbList` en todo lo que no sea el home.
- El menú principal: Servicios · Soluciones · Proyectos · Empresa · **Cotizar** (botón) · WhatsApp.

### Plantilla de página de servicio (`/servicios/[slug]`)
1. Hero con H1 orientado a búsqueda ("Desarrollo de páginas web para empresas en Lima") + CTA doble.
2. Problema que resuelve (en lenguaje del dueño de negocio, no técnico).
3. Qué incluye (entregables concretos).
4. Cómo funciona (3–4 pasos).
5. Rango de inversión orientativo ("desde S/ X") + mantenimiento.
6. Demo relacionada (si existe).
7. FAQ (5–6 preguntas reales de clientes).
8. Sectores donde aplica (enlaces).
9. FinalCTA.

### Plantilla de página de sector (`/soluciones/[slug]`)
Igual estructura, centrada en dolores del sector (ej. clínicas: agenda de citas, consultas repetidas por WhatsApp, recordatorios) y en qué combinación de servicios lo resuelve.

---

## 5. Home: secciones y su función

| Orden | Sección | Función en el embudo | Notas |
|-------|---------|----------------------|-------|
| 1 | Header | Navegación + CTA "Cotizar" siempre visible | Glass, sticky, logo SVG |
| 2 | **Hero** | Captar atención y dar 2 caminos | H1 sobre IA/automatización para empresas. CTA 1: WhatsApp. CTA 2: "Cotiza tu proyecto en 1 minuto" (abre cotizador). Escena 3D detrás |
| 3 | Prueba técnica | Credibilidad inmediata | Franja con métricas **reales** del propio sitio (Lighthouse, tiempo de carga) y stack |
| 4 | Servicios | Qué vendemos | 4 tarjetas → enlazan a `/servicios/*` |
| 5 | **Matriz de valor** | Justificar el precio | Web tradicional vs. Sistema Xapiensys. Filas orientadas a negocio: captación, atención 24/7, seguimiento de leads, velocidad, SEO, mantenimiento |
| 6 | **Chat IA en vivo** | Demostrar + captar | Isla real. Si el usuario lo pide, toma sus datos y crea el lead |
| 7 | Soluciones por sector | Identificación ("esto es para mí") | 3 tarjetas → `/soluciones/*` |
| 8 | Laboratorio / Demos | Mostrar capacidad sin inventar casos | Demos etiquetadas "Demo", con métricas técnicas reales de cada demo |
| 9 | Proceso | Reducir incertidumbre | 4 pasos |
| 10 | Inversión orientativa | Filtrar leads | Rangos "desde S/ 1,500" + mantenimiento. Link al cotizador |
| 11 | Cobertura | SEO local + confianza | Lima base, Perú, LatAm, remoto. SVG geométrico |
| 12 | FAQ | Objeciones + SEO | 6 preguntas |
| 13 | CTA final + Footer | Cierre | NAP completo, redes, privacidad |

---

## 6. Frontend

### 6.1 Sistema de diseño
- `tokens.css` define todo: `--color-*`, `--font-*`, escala tipográfica fluida con `clamp()`, `--space-*` (escala de 4 px), `--radius-*`, `--glass-bg`, `--glass-border`, `--glow-cyan`, `--glow-violet`, `--z-*`.
- Componentes base: `Button` (primary cian, secondary outline, ghost), `GlassPanel`, `SectionLabel` (el estilo "02 / DISEÑO PARA CRECER" actual se conserva, es parte de la identidad).
- Iconos: SVG inline en `Icon.astro` (trazo 1.5 px, `currentColor`).
- Animaciones: CSS (`@keyframes`, `view-timeline` donde haya soporte) con `prefers-reduced-motion` respetado. Sin librerías de animación.

### 6.2 Escena 3D (`Scene3D.ts`)
> Implementada en WebGL nativo, no con Three.js (ver §12). El resto de este apartado se cumple tal cual, con una precisión: en móvil la escena carga tras la primera interacción (scroll o toque), no por `requestIdleCallback`.

- Concepto: campo de partículas / red geométrica de nodos conectados (metáfora de sistemas e IA) en cian y violeta, reaccionando suave al puntero y al scroll. Sin modelos `.glb`.
- Carga: `<canvas>` fijo detrás del contenido, `aria-hidden`. El módulo se importa dinámicamente tras `requestIdleCallback` (timeout 2 s) **solo si** el dispositivo es apto.
- Niveles de calidad según dispositivo (`hardwareConcurrency`, `deviceMemory`, ancho): alto (~3,000 partículas), medio (~1,200), bajo → SVG estático.
- `devicePixelRatio` limitado a 1.5. Pausa el loop con `visibilitychange` y cuando el hero sale del viewport (`IntersectionObserver`).
- Importar solo lo necesario de `three` (`BufferGeometry`, `Points`, `ShaderMaterial`, `PerspectiveCamera`, `WebGLRenderer`, `Scene`) para que el chunk quede ≤ 250 KB minificado.
- Fade-in de 600 ms al estar listo: la aparición no puede causar CLS.

### 6.3 Chat IA (`ChatDemo.tsx`)
- UI: ventana glass con header "Asistente X", estado, burbujas, sugerencias rápidas, input, indicador "escribiendo", streaming token a token.
- Se hidrata con `client:visible` (solo cuando entra en pantalla).
- Primer mensaje y sugerencias se renderizan en HTML estático (SEO + sin espera).
- Aviso visible y breve: "Asistente con IA de Xapiensys. Las conversaciones se guardan para mejorar el servicio. [Privacidad]".
- Cuando el modelo detecta intención de compra, muestra un mini-formulario en el chat (nombre, negocio, WhatsApp) → `POST /api/lead` con `source: "chat"`.
- Si el servidor responde `429` o `limit_reached`: cambia a modo guiado (botones predefinidos) + CTA de WhatsApp. El usuario nunca ve un error técnico.

### 6.4 Cotizador (`Quoter.tsx`)
Pasos (uno por pantalla, barra de progreso, ≤ 60 s en total):
1. ¿Qué necesitas? (página web · chatbot IA · automatización · sistema a medida · no estoy seguro) — selección múltiple.
2. ¿De qué sector es tu negocio? (clínica/salud · construcción/inmobiliaria · comercio/restaurante · servicios profesionales · otro).
3. Alcance (ej. para web: nº de secciones aprox.; para chatbot: canal web/WhatsApp; para automatización: nº de procesos).
4. ¿Para cuándo lo necesitas? (urgente < 2 semanas · este mes · 1–3 meses · explorando).
5. Datos: nombre, empresa, WhatsApp, email (opcional), consentimiento.

Resultado: `POST /api/quote` devuelve rango de inversión + mantenimiento sugerido + entregables incluidos + código `XP-####`. Botón principal: "Continuar por WhatsApp" con mensaje prellenado que incluye el código y el resumen. El cálculo **siempre** ocurre en el servidor (`lib/pricing.ts`).

Se usa embebido en el home (modal o sección) y a pantalla completa en `/cotizar`.

### 6.5 Accesibilidad
WCAG 2.2 AA: contraste del cian sobre fondo oscuro verificado para texto pequeño (si no cumple, cian solo en elementos grandes o decorativos), foco visible cian, skip-link, `aria-live` en el chat, formularios con `label` real y errores asociados.

---

## 7. Backend

### 7.1 Endpoints

| Método | Ruta | Entrada (Zod) | Salida | Protección |
|--------|------|---------------|--------|-----------|
| POST | `/api/lead` | `name, company?, phone, email?, need[], sector?, message?, source: "form"\|"chat"\|"quote", consent: true, utm?, turnstileToken, website (honeypot)` | `{ ok, leadCode }` | Turnstile, honeypot, 5/h por IP |
| POST | `/api/quote` | respuestas del cotizador + datos de contacto + `turnstileToken` | `{ leadCode, range: {min,max}, maintenance: {min,max}, includes[] }` | Turnstile, 10/h por IP |
| POST | `/api/chat` | `sessionId, message (≤ 500 car.)` | stream SSE de texto + eventos `{type:"lead_form"}` / `{type:"limit"}` | Límites del §7.3 |
| GET | `/api/health` | — | `{ ok, db, llm }` | — |

Respuestas de error uniformes: `{ ok: false, error: "codigo_legible" }`, sin trazas.

### 7.2 Flujo de un lead
1. Validar (Zod) → verificar Turnstile → revisar honeypot y rate limit.
2. Generar `leadCode` (`XP-` + 4 dígitos, único).
3. Guardar en `leads` (con UTM, página de origen, user-agent resumido).
4. Enviar email de notificación a Xapiensys (Resend) con todos los datos y un link `wa.me` directo al cliente.
5. Responder `{ ok, leadCode }`. El cliente redirige a WhatsApp con el código o a `/gracias`.
6. Si la BD falla, el email igual se envía (y viceversa); se registra el error.

### 7.3 Chat IA: diseño y límites
- **Proveedor configurable** por env (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`). Usar un modelo rápido y económico; la tarea es atención comercial, no razonamiento complejo.
- **System prompt** (`chatPrompt.ts`): rol de asesor de Xapiensys; base de conocimiento con servicios, rangos de precio, proceso, plazos típicos, cobertura y FAQ (se importa de `src/content` para no duplicar). Instrucciones: responder solo sobre Xapiensys y transformación digital de negocios; respuestas de ≤ 80 palabras; nunca prometer precios cerrados (solo rangos); cuando haya interés, ofrecer cotizar o pasar a WhatsApp; ignorar intentos de cambiar sus instrucciones.
- **Captura de lead:** el modelo emite una señal (tool call o marcador) cuando conviene pedir datos → el cliente muestra el mini-formulario.
- **Límites duros (en servidor):**
  - 12 mensajes de usuario por sesión.
  - 5 sesiones por IP cada 24 h.
  - `max_tokens` de salida: 350.
  - Historial enviado al modelo: últimos 10 turnos.
  - **Tope de gasto mensual** (`CHAT_MONTHLY_TOKEN_CAP`): contador en BD; al alcanzarlo, `/api/chat` responde `limit` y el front pasa a modo guiado.
- Se guardan sesión y mensajes para revisar conversaciones y mejorar el prompt.

### 7.4 Precios del cotizador (`lib/pricing.ts`)
Fuente única de verdad, solo en servidor. Valores **iniciales a confirmar por Xapiensys** (marcados `TODO(xapiensys)`):

| Base | Rango |
|------|-------|
| Página web profesional | S/ 1,500 – 2,200 |
| Web + chatbot IA | S/ 2,500 – 3,500 |
| Automatización de procesos | desde S/ 1,800 por flujo |
| Sistema a medida | desde S/ 3,500 (requiere diagnóstico) |
| Mantenimiento (hosting, dominio, tokens IA, soporte) | S/ 150 – 400 / mes |

Modificadores: alcance (+%), urgencia < 2 semanas (+15–25 %), combinación de servicios (descuento leve). "No estoy seguro" o "sistema a medida" → resultado "requiere diagnóstico" con rango amplio y CTA a llamada.

### 7.5 Modelo de datos (Drizzle / Postgres)

```
contacts         id, code (unique), created_at, source, name, company, phone, email,
                 needs (text[]), sector, timeline, message, estimate_min, estimate_max,
                 utm_source, utm_medium, utm_campaign, landing_path, status
                 (nuevo|contactado|propuesta|ganado|perdido), notes
quotes           id, lead_id → leads, answers (jsonb), result (jsonb), created_at
chat_sessions    id (uuid), created_at, ip_hash, message_count, lead_id → leads (nullable)
chat_messages    id, session_id → chat_sessions, role, content, tokens_in, tokens_out, created_at
rate_limits      key (ip_hash:endpoint), window_start, count
usage_monthly    month (YYYY-MM), tokens_in, tokens_out, cost_estimate
```

- IP guardada siempre como hash con sal (`IP_HASH_SALT`), nunca en claro.
- Retención: mensajes de chat 12 meses.
- Para ver leads al inicio basta el panel de Neon/Supabase + el email. Un panel `/admin` propio queda como fase opcional (ROADMAP F6).

### 7.6 Variables de entorno (`.env.example`)
```
DATABASE_URL=
RESEND_API_KEY=
LEAD_NOTIFY_EMAIL=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
EMAIL_FROM=
LLM_PROVIDER=anthropic
LLM_MODEL=
LLM_API_KEY=
CHAT_MONTHLY_TOKEN_CAP=
IP_HASH_SALT=
PUBLIC_GA4_ID=
PUBLIC_SITE_URL=https://xapiensys.com
```

---

## 8. SEO técnico

- **Metas** por página vía `Seo.astro` (props: `title`, `description`, `path`, `ogImage?`, `noindex?`).
- **Schema.org** vía `SchemaOrg.astro`:
  - Global: `Organization` + `ProfessionalService` (`@id: https://xapiensys.com/#organization`) con `name`, `alternateName: ["Xapiens","Xapiensis","Xapiensys Perú"]`, `logo`, `url`, `email`, `telephone`, `address` (Lima, PE), `areaServed`, `sameAs`, `priceRange: "S/ 1,500 – S/ 3,500+"`, `knowsAbout`. `WebSite` con `publisher`.
  - Servicios: `Service` con `provider`, `areaServed`, `offers.priceSpecification` (mínimo).
  - Sectores y servicios: `BreadcrumbList`.
  - Demos: `CreativeWork` con `isPartOf` del sitio.
  - No usar `Review`/`AggregateRating` sin reseñas reales.
- **Sitemap** automático, `robots.txt` apuntando a él, `lastmod` real.
- **OG images:** una base `og-image.png` + variantes por página generadas en build (SVG → PNG con `satori`/`sharp`) con el título de la página, manteniendo la estética.
- **Rendimiento = SEO:** HTML estático, fuentes con preload, CSS crítico inline (Astro lo hace por página), 3D diferido.
- **Redirects**: `www ↔ apex` se configura en Vercel → *Settings → Domains* (no en `vercel.json`, para no crear un bucle con la redirección del dominio), rutas antiguas `/#servicios` no aplican (son anclas), `/index.html → /`.
- **Fuera del código, pero imprescindible:** Google Business Profile verificado con el mismo NAP, Search Console con sitemap enviado, perfiles sociales con el link al sitio.

---

## 9. Analítica y medición

- **GA4** cargado después de la interacción o tras `load` + idle (no bloquea el render). Alternativa más ligera: Plausible/Umami.
- Eventos (`track()`):
  `cta_whatsapp_click {location}` · `quote_start` · `quote_step {step}` · `quote_complete {range}` · `lead_submit {source}` · `chat_open` · `chat_message {n}` · `chat_lead_form_shown` · `chat_limit_reached` · `demo_view {slug}`.
- UTM y `landing_path` se guardan en `sessionStorage` al llegar y se envían con el lead.
- El `leadCode` en el mensaje de WhatsApp conecta la conversación con el registro en BD: así se sabe qué canal produce clientes reales.

---

## 10. Seguridad y cabeceras (`vercel.json`)
- `Content-Security-Policy` estricta (self + Turnstile + GA4 + dominio del LLM solo desde servidor, no cliente).
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` mínima.
- Caché: assets con hash `immutable, max-age=31536000`; HTML `max-age=0, must-revalidate`.
- La API key del LLM nunca llega al navegador; todas las llamadas pasan por `/api/chat`.

---

## 11. Showcase sin casos reales (estrategia)

Hoy no hay proyectos publicables, así que la sección se llama **"Laboratorio"** y muestra demos propias, cada una con la etiqueta **"Demo"**:

1. **Demo Clínica** — landing + chatbot que agenda citas (flujo simulado claramente).
2. **Demo Constructora** — cotizador de obra/remodelación con captura de lead.
3. **Demo Comercio** — catálogo + pedidos por WhatsApp.

Cada demo muestra solo métricas técnicas **medidas** (Lighthouse, tiempo de carga, peso) y "qué problema resolvería". Cuando haya clientes reales, la colección `proyectos` admite `type: "caso"` con métricas reales y permiso del cliente, sin cambiar la arquitectura.

Sugerencia comercial (fuera del código): ofrecer a los 2–3 primeros clientes una condición especial a cambio de poder publicar el caso con métricas.

---

## 12. Decisiones tomadas (registro)

| Decisión | Elegido | Alternativas descartadas | Motivo |
|----------|---------|--------------------------|--------|
| Framework | Astro | Next.js, HTML puro | HTML estático + islas = máximo SEO y CWV; escala a multipágina sin duplicar código |
| Backend | Endpoints Astro en Vercel Functions | FastAPI aparte | Un repo, un deploy, sin servidor que mantener |
| Tabla de contactos (2026-10-31) | `contacts` (antes `leads`; migración `0002` que la renombra conservando datos) | Dos tablas separadas | Un solo registro para formulario, diagnóstico, cotizador y chat; el panel `/admin` lee de ahí |
| Panel de leads (2026-10-31) | `/admin` propio con `ADMIN_PASSWORD` y cookie HMAC (12 h), formularios sin JS | Netlify Identity / auth externa | Cero dependencias y cero costo; CSRF por origen, bloqueo tras 5 intentos/15 min, CSV con protección contra fórmulas |
| Imágenes (2026-10-31) | `src/assets/` + `astro:assets` (`<Picture>` AVIF/WebP) y `image()` en el esquema | Imágenes en `public/` | Se optimizan al construir, sin CLS, y el build falla si falta un archivo o su texto alternativo |
| Prospección (2026-10-31) | Landing `/diagnostico` + UTM first-touch + prellenado por URL | Formularios por campaña | Una sola página medible para todos los mensajes; la campaña queda en cada lead |
| Hosting (2026-10-30) | Vercel (`@astrojs/vercel`, `maxDuration: 30`) | Netlify | Netlify bloqueó los deploys por falta de créditos. Funciones Node 22 con streaming (necesario para el chat SSE); IP del cliente desde `x-real-ip` |
| Chat | IA real con límites | Simulado | Una agencia de IA necesita una demo real; los límites controlan el costo |
| Simulador del hero | Cotizador + diagnóstico | Calculadora ROI | Califica y captura el lead con datos útiles para vender |
| Showcase | Demos propias etiquetadas | Casos inventados | Honestidad y riesgo legal; arquitectura lista para casos reales |
| Islas | Preact | React | ~4 KB vs ~45 KB |
| Escena 3D (2026-10-30) | WebGL nativo (`Scene3D.ts`, ~6 KB) | Three.js r186 por módulos | `three` tree-shakeado pesaba ~530 KB minificado (WebGLRenderer arrastra toda la librería de shaders), más del doble del presupuesto de 250 KB. Mismo efecto (nodos + conexiones, shaders propios). Si en el futuro hace falta Three.js (modelos, post-procesado), evaluar de nuevo el presupuesto |
| Modelo del chat (2026-10-30) | `claude-haiku-5-5` vía SDK oficial `@anthropic-ai/sdk`, `effort: low`, sin thinking, `max_tokens` 350 | Modelos más grandes | §7.3 pide modelo rápido y económico. Cambiable con `LLM_MODEL`. `LLM_PROVIDER` hoy solo acepta `anthropic`; `lib/server/llm.ts` define la interfaz `ChatProvider` para agregar otro |
| Señal de captura de lead | Herramienta `mostrar_formulario_contacto` (tool use) | Marcador en texto | No hay que filtrar marcadores del stream; el historial guarda solo el texto |
| Driver de Postgres | `postgres` (postgres-js) + Drizzle | `@neondatabase/serverless` | Funciona igual con Neon o Supabase (URL del pooler, `prepare: false`) |
| Degradación sin claves | Todas las variables son opcionales | Fallar el build | Sin BD: límites en memoria; sin Resend: solo BD; sin ambos: `/api/lead` responde 503 y el front ofrece WhatsApp; sin LLM: modo guiado; sin `TURNSTILE_SECRET_KEY`: se omite Turnstile (honeypot y rate limit siguen) |
| CSS | Incrustado en cada página (`inlineStylesheets: 'always'`) | Hojas externas | Eliminó 12 peticiones que bloqueaban el render; LCP móvil del home bajó de 2.3 s a 1.7 s |
| CSP | `security.csp` de Astro (meta con hashes) + cabeceras en `vercel.json` | `unsafe-inline` | Ningún `style=""` ni script en línea sin hash |
| Envío sin JS | `/api/lead` acepta `application/x-www-form-urlencoded` y redirige a `/gracias` | Solo JSON | El formulario de `/contacto` funciona sin JavaScript |
| URLs | `trailingSlash: 'never'` (el adaptador de Vercel redirige `/ruta/` → `/ruta` con 308) | Barra final | Coincide con los canonicals sin barra |
