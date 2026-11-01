# Assets generados con Higgsfield (línea 3D)

Preámbulo de estilo (repetir en todos los prompts): *Cinematic dark scene, deep navy-black background with cyan (#00F0FF) and violet (#7C3AED) rim lighting, glass and brushed metal, minimal, no text.*

Son gráficos propios de la marca generados con IA (no de stock). Viven en `src/assets/marca/` y se optimizan con `astro:assets`.

| Archivo | Modelo | Job ID | Créditos | Fecha |
|---|---|---|---|---|
| (origen del 3D) hero-x.png | gpt_image_2_5 | 860ff8fc-8f9a-4391-ac72-f0c637be2e54 | 0.25 | 2026-11-01 |
| public/3d/x.bin + x.webp | tripo_h3_1_image_to_3d, 20k caras, PBR | bc5c9c6d-d272-436a-b06f-1cd41e968a13 | 9 | 2026-11-01 |
| src/assets/marca/x-poster.webp (recorte sin fondo) | image_background_remover | 888e0716-f1f8-436d-bd48-38e409e9000e | ~0 | 2026-11-01 |
| src/assets/marca/web.webp | gpt_image_2_5 | 44084e5e-d725-454e-a3e4-902be491ba5a | 0.25 | 2026-11-01 |
| src/assets/marca/chatbot.webp | gpt_image_2_5 | 39d0ebb1-261c-467e-b49b-e6d6e0f0a6d6 | 0.25 | 2026-11-01 |
| src/assets/marca/automation.webp | gpt_image_2_5 | 8cc1e36a-c741-49ef-8ac7-7919d6867b2b | 0.25 | 2026-11-01 |
| src/assets/marca/lima.webp | gpt_image_2_5 | f53cb79d-4743-49c6-87a5-82494be489b9 | 0.25 | 2026-11-01 |
| src/assets/marca/globe.webp | gpt_image_2_5 | fadb01fe-1c07-4d14-8336-c347f8e59017 | 0.25 | 2026-11-01 |

## Regenerar el modelo
1. Descargar el GLB del job de Tripo y guardarlo como `assets/src/x-raw.glb` (carpeta ignorada por git).
2. Quitar mapas innecesarios: `npx @gltf-transform/cli resize x-raw.glb s1.glb --width 1024 --height 1024`, luego `webp s1.glb s2.glb --slots baseColorTexture`.
3. `node scripts/pack-model.mjs assets/src/s2.glb` → escribe `public/3d/x.bin` y `x.webp`.

## Notas técnicas
- Tripo exporta la X de canto (plano Y–Z): `HeroModel.ts` la gira 90° para que mire a la cámara.
- `HeroModel.ts` lo monta `sceneBoot.ts` solo en escritorio (≥ 900 px, puntero fino), con WebGL, sin `prefers-reduced-motion` ni `saveData`. Si falla o va lento (>45 de 90 fotogramas lentos), se vuelve al póster.
- Interacciones en `src/components/islands/fx.ts` (aparición al scroll, tilt de tarjetas, botones magnéticos, luz del cursor, progreso, enlace activo).
