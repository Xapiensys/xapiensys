# Prospección y conversión — cómo usar el sitio para vender

El sitio ya mide de dónde viene cada interesado. Para que esa medición sirva, **todo enlace que
envíes en una campaña debe llevar parámetros UTM**. Así, en `/admin` ves qué mensajes y qué canales
traen clientes de verdad.

## 1. Antes de empezar (una sola vez)

En Vercel → *Settings → Environment Variables* (y luego *Redeploy*):

| Variable | Para qué | Sin ella… |
|---|---|---|
| `DATABASE_URL` | Guardar leads y verlos en `/admin` | Los leads solo llegan por email |
| `RESEND_API_KEY`, `LEAD_NOTIFY_EMAIL`, `EMAIL_FROM` | Aviso inmediato por email + confirmación al cliente | Solo quedan en la BD |
| `ADMIN_PASSWORD` (≥ 12 caracteres) | Entrar a `/admin` | El panel queda desactivado |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Frenar bots en formularios | Solo honeypot + límite por IP |
| `LLM_API_KEY` | Chat con IA real | El chat funciona en modo guiado |
| `PUBLIC_BOOKING_URL` | Botón "Agendar una llamada" (Cal.com, Calendly…) | El botón no aparece |
| `PUBLIC_GA4_ID` | Embudo en Google Analytics | Sin analítica externa |
| `IP_HASH_SALT` | Anonimizar IPs | Usa una sal por defecto (cámbiala) |

Las tablas se crean y actualizan solas en cada despliegue de Vercel (`vercel-build` ejecuta `scripts/db-migrate.mjs`). En local: `DATABASE_URL="…" npm run db:migrate`.

## 2. A dónde enviar a cada prospecto

| Situación | Enlace |
|---|---|
| Primer contacto en frío (no sabe qué necesita) | `/diagnostico` |
| Sabe que necesita web/chatbot y pregunta precio | `/cotizar` |
| Es de un sector con página propia | `/soluciones/clinicas`, `/soluciones/constructoras`, `/soluciones/comercios` |
| Pregunta por un servicio concreto | `/servicios/paginas-web`, `/servicios/chatbots-ia`, `/servicios/automatizacion`, `/servicios/sistemas-a-medida` |
| Quiere ver capacidad técnica | `/#demo` (chat en vivo) o `/proyectos` |

### Enlaces personalizados para `/diagnostico`

Además de UTM, acepta `empresa` y `sector` para **prellenar el formulario**:

```
https://xapiensys.com/diagnostico?empresa=Clinica%20San%20Luis&sector=clinicas&utm_source=whatsapp&utm_medium=prospeccion&utm_campaign=clinicas-lima-2026-11
```

`sector` acepta: `clinicas`, `constructoras`, `comercios`, `servicios`, `otro`.
Los espacios del nombre se escriben `%20`.

## 3. Convención de UTM (úsala siempre igual)

| Parámetro | Valores | Ejemplo |
|---|---|---|
| `utm_source` | Canal: `whatsapp`, `linkedin`, `instagram`, `facebook`, `email`, `google` | `whatsapp` |
| `utm_medium` | Tipo: `prospeccion` (en frío), `seguimiento`, `organico`, `anuncio` | `prospeccion` |
| `utm_campaign` | `sector-ciudad-año-mes`, en minúsculas y con guiones | `clinicas-lima-2026-11` |

En `/admin` puedes buscar por campaña (`clinicas-lima-2026-11`) y ver cuántos leads trajo.

## 4. Plantillas de primer mensaje

Cortas, sin promesas que no podamos cumplir. Personaliza el detalle observado: es lo que hace
que respondan.

**WhatsApp / LinkedIn (frío)**
> Hola {nombre}, soy {tu nombre} de Xapiensys. Vi que {detalle real: "su web tarda en cargar en el
> celular" / "reciben consultas por WhatsApp a cualquier hora"}. Ayudamos a {sector} en Lima a
> responder consultas y captar clientes con su web y un asistente con IA. Si te sirve, te hago un
> Diagnóstico Digital Gratuito de 15 minutos: {enlace /diagnostico personalizado}

**Seguimiento (3–5 días después, una sola vez)**
> Hola {nombre}, te escribo por si se perdió mi mensaje. Si prefieres ver números antes de
> conversar, aquí calculas un rango en 1 minuto: {enlace /cotizar con UTM}

**Email**
> Asunto: Una idea para {empresa}
> Hola {nombre}: revisé {web / perfil} de {empresa} y encontré {1 observación concreta}. En
> Xapiensys trabajamos web, chatbots con IA y automatización para empresas en Perú. ¿Te parece si
> te comparto un diagnóstico breve? Puedes pedirlo aquí: {enlace}.

Reglas: no inventes casos ni clientes (hoy mostramos demos propias); no prometas precios cerrados
(solo rangos); respeta a quien pide no ser contactado de nuevo.

## 5. Qué pasa cuando alguien deja sus datos

1. El lead se guarda con su código `XP-####`, origen (formulario, cotizador, chat o diagnóstico),
   UTM y página de llegada.
2. Te llega un email con todos los datos, un botón para escribirle por WhatsApp y otro para abrirlo
   en el panel.
3. Si dejó email, recibe una confirmación con su código y el enlace para continuar por WhatsApp
   (y para agendar, si configuraste `PUBLIC_BOOKING_URL`).
4. Si escribe por WhatsApp, su mensaje trae el código: búscalo en `/admin` y tendrás todo el
   contexto (incluida la conversación con el chat, si la hubo).

## 6. Trabajar los leads en `/admin`

Estados: **Nuevo → Contactado → Propuesta enviada → Ganado / Perdido**. Cambia el estado y
deja una nota cada vez que hables con el cliente. Exporta a CSV cuando quieras analizar en Excel.

Ritmo recomendado: responder los "Nuevo" el mismo día y revisar una vez por semana qué
`utm_campaign` trajo más leads y cuáles pasaron a "Propuesta".
