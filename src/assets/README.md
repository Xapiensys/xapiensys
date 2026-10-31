# Imágenes del sitio (`src/assets/`)

Todo lo que pongas aquí lo optimiza Astro al construir: genera **AVIF y WebP** en varios
tamaños, con `width`/`height` (sin saltos de diseño) y carga diferida. Sube siempre el
original de mejor calidad; no hace falta comprimirlo antes.

> Regla de marca (CLAUDE.md): **cero imágenes de stock**. Solo capturas reales de proyectos,
> fotos reales del equipo y gráficos propios.

## Dónde va cada cosa

| Carpeta | Qué subir | Dónde aparece |
|---|---|---|
| `proyectos/<slug>/` | Capturas reales de una demo o de un proyecto (con permiso del cliente) | Tarjeta del Laboratorio y página `/proyectos/<slug>` |
| `equipo/` | Fotos reales del equipo | Reservado para `/empresa` (pendiente de aprobar textos) |
| `marca/` | Gráficos propios (diagramas, piezas de marca) | Donde se importen |

`public/` es solo para archivos que deben servirse tal cual (favicon, `og-image.png`, fuentes).

## Formato recomendado

- **Capturas de pantalla:** PNG o WebP, ancho ≥ 1600 px, proporción 16:10 (ej. 1600×1000).
- **Fotos:** JPG, lado mayor ≥ 1600 px.
- Nombres en minúsculas y con guiones: `home-escritorio.png`, `chatbot-movil.png`.
- Peso del original: idealmente < 5 MB (Astro reduce el resultado).

## Cómo conectar una imagen a un proyecto

1. Copia la imagen en `src/assets/proyectos/<slug>/`, por ejemplo
   `src/assets/proyectos/clinica-chatbot-citas/home.png`.
2. En `src/content/proyectos/<slug>.md` agrega (rutas relativas al `.md`):

```yaml
cover: ../../assets/proyectos/clinica-chatbot-citas/home.png
coverAlt: Página de inicio de la demo de clínica con el asistente abierto
gallery:
  - src: ../../assets/proyectos/clinica-chatbot-citas/chat-movil.png
    alt: Conversación del asistente agendando una cita en el celular
```

3. `npm run build`: si la ruta está mal o falta el texto alternativo, el build falla y te
   dice qué corregir.

El texto alternativo (`coverAlt`, `alt`) es obligatorio: describe lo que se ve (accesibilidad
y SEO de imágenes). No escribas "imagen de…".
