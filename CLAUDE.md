# CLAUDE.md — Xapiensys (xapiensys.com)

Sitio corporativo de **Xapiensys**: agencia de ingeniería de software, desarrollo web, automatización e IA para PyMEs y empresas en Perú y Latinoamérica. El sitio es a la vez **canal de ventas** y **demo en vivo** de lo que vendemos. Si algo no ayuda a captar, medir o convertir un lead, no es prioridad.

Lee antes de cualquier tarea:
- `docs/ARCHITECTURE.md` — arquitectura completa (stack, rutas, backend, datos, SEO, rendimiento).
- `docs/ROADMAP.md` — fases de trabajo con criterios de aceptación. **Trabaja una fase a la vez** y no avances sin cumplir sus criterios.
- `docs/PROSPECCION.md` — cómo se usan el sitio y el panel `/admin` para prospectar y convertir.
- Imágenes: van en `src/assets/` (guía en `src/assets/README.md`), nunca en `public/` salvo favicon/OG/fuentes.

## Stack
- **Astro** (última versión estable; `output: 'static'`, adaptador `@astrojs/vercel`). Las páginas se prerenderizan; solo `src/pages/api/*` corre en servidor (`export const prerender = false`).
- **TypeScript estricto** en todo el proyecto.
- **Islas** (único JS en el cliente): escena 3D, chat IA, cotizador, menú móvil. Preact o JS vanilla; **no React** (peso).
- **Escena 3D en WebGL nativo** (`src/components/islands/Scene3D.ts`). Three.js se descartó por peso (ver ARCHITECTURE §12); si se reintroduce, debe respetar el presupuesto de 250 KB.
- **Backend:** endpoints Astro en Vercel Functions. **Zod** para validar toda entrada. **Drizzle ORM** + **Postgres** (Neon/Supabase). **Resend** para emails.
- Hosting: **Vercel** (conectado al repo de GitHub). Cabeceras y redirects en `vercel.json`.

## Comandos
```bash
npm run dev        # servidor local (astro dev)
npm run build      # build de producción
npm run preview    # previsualizar build
npm run check      # astro check + tsc
npm run lint       # eslint + prettier --check
npm run db:push    # aplicar esquema Drizzle (requiere DATABASE_URL)
npm run db:generate # generar migración SQL en drizzle/
npx lighthouse http://localhost:4321 --preset=desktop   # y sin preset para móvil
```

## Reglas innegociables

### Dirección de arte
- Estética ejecutiva, minimalista, futurista e industrial (referencias: SpaceX, Tesla, Spotify). Sobria, nunca "gamer" ni recargada.
- Colores solo desde tokens en `src/styles/tokens.css`: fondo `#0a0a0f`, superficie `#11111a`, cian `#00f0ff`, violeta `#7c3aed`, texto `#e8ecf5`, apagado `#8a94a8`. Nada de colores sueltos en componentes.
- Tipografía: **Space Grotesk** (títulos) e **Inter** (cuerpo), self-hosted en `/public/fonts`, `font-display: swap`, con `preload` de las dos.
- Glassmorphism con moderación: `backdrop-filter` solo en header, chat y tarjetas destacadas (es caro en móviles).
- **Cero imágenes de stock.** Gráficos en SVG inline o generados por código. Nunca dejar un `<img>` sin archivo real, ni huecos "placeholder". Única excepción: `og-image.png` y capturas reales de proyectos.

### Rendimiento (presupuesto, se verifica en cada PR)
- Lighthouse móvil ≥ 95 en Performance, Accessibility, Best Practices y SEO.
- LCP < 2.0 s (móvil, 4G simulado) · CLS < 0.05 · INP < 200 ms.
- JS inicial (sin la escena 3D) ≤ 30 KB gzip por página.
- Chunk 3D ≤ 250 KB minificado. Se carga **después** del contenido (`requestIdleCallback` o tras el primer scroll/interacción), solo si el dispositivo es apto (`hardwareConcurrency ≥ 4`, sin `prefers-reduced-motion`, sin `saveData`). Si no, fallback SVG estático.
- La escena 3D nunca es el elemento LCP: el H1 y el texto del hero renderizan en HTML puro.

### SEO
- Una sola `<h1>` por página. Jerarquía de headings estricta.
- Cada página define `title` (≤ 60 car.), `description` (≤ 155 car.), canonical absoluto y OG/Twitter mediante el componente `Seo.astro`. Nunca escribir metas a mano en una página.
- JSON-LD vía `SchemaOrg.astro`: `Organization`+`ProfessionalService` en todas; `Service`, `BreadcrumbList`, `WebPage` según tipo de página.
- Variantes de marca (`Xapiensys`, `Xapiens`, `Xapiensis`) en `alternateName` y de forma natural en el texto de `/empresa`. No hacer keyword stuffing.
- `sitemap.xml` generado (`@astrojs/sitemap`), excluye `/api/*` y `/gracias`.
- Idioma `es-PE`. Español neutro peruano, tuteo, tono directo y profesional.

### Backend y seguridad
- Toda entrada del cliente se valida con Zod en el servidor. Nunca confiar en precios o datos calculados en el cliente.
- Secretos solo en variables de entorno (ver `.env.example`). Nunca en el repo ni en el bundle del cliente.
- Formularios: honeypot + Cloudflare Turnstile + rate limit por IP.
- El chat IA tiene límites duros (mensajes por sesión, sesiones por IP, tope de gasto mensual). Si se supera cualquier límite, degrada a modo guiado + WhatsApp; nunca muestra un error crudo.
- Datos personales según Ley 29733 (Perú): checkbox de consentimiento en formularios y enlace a `/privacidad`.

### Honestidad del contenido
- **No inventar** clientes, testimonios, logos de clientes ni métricas de ROI. Hoy no hay casos publicables: la sección de proyectos muestra **demos propias etiquetadas como "Demo"**. Las únicas métricas permitidas son medidas reales (ej. Lighthouse del propio sitio o de una demo).
- Si falta un dato (precio, correo, texto legal), dejar `TODO(xapiensys):` visible en el código y avisar; no rellenar con supuestos.

## Convenciones
- Componentes en `PascalCase.astro`; utilidades en `camelCase.ts`.
- CSS: un archivo por componente (scoped en Astro) + `tokens.css` + `global.css`. Sin Tailwind.
- Contenido editable (servicios, sectores, demos, FAQ) en `src/content/` con colecciones tipadas; el texto no va hardcodeado en componentes.
- Enlaces a WhatsApp siempre con `buildWhatsAppUrl()` de `src/lib/whatsapp.ts` (mensaje prellenado + código de lead).
- Cada CTA dispara un evento de analítica con `track()` de `src/lib/analytics.ts`.
- Commits pequeños, en español, formato `tipo(área): descripción` (ej. `feat(cotizador): cálculo de rangos en servidor`).

## Antes de dar una tarea por terminada
1. `npm run check` y `npm run build` sin errores.
2. Lighthouse móvil dentro del presupuesto en las páginas tocadas.
3. Revisión visual en 360 px, 768 px y 1440 px.
4. Navegación por teclado y foco visible en lo nuevo.
5. Actualizar `docs/ROADMAP.md` marcando lo completado.
