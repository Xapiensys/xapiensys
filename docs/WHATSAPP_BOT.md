# Respuesta automática de WhatsApp

`/api/whatsapp` recibe los mensajes de WhatsApp (Cloud API de Meta) y responde al instante:

- **Con código** (`XP-6365`, `xp 6365`, `xp6365`): saluda por su nombre, repite lo que pidió y hace
  3 preguntas de calificación (resultado esperado, fecha y presupuesto). Deja una nota en el lead (`/admin`).
- **Sin código:** saludo y pide que cuente qué necesita, con enlace a `/cotizar`.
- **Una sola respuesta automática por número cada 12 h** (y otra si después manda su código).
  El resto de la conversación es tuya.
- Te llega un correo `[WhatsApp] … te escribió` con el mensaje y el enlace al chat.
- No da precios ni plazos.

Código: `src/lib/server/whatsappBot.ts` (textos en `buildReply`) y `src/pages/api/whatsapp.ts`.
Sin las variables de entorno el endpoint queda apagado y no afecta al sitio.

## Activación (🧑, unos 30–60 min)

1. **App de Meta:** en developers.facebook.com → *Crear app* → tipo *Empresa* → añade el producto
   **WhatsApp**. Vincúlala al portafolio comercial (Business Manager) de Xapiensys.
2. **Número:** en *WhatsApp → Configuración de la API*, registra el número que atenderá.
   - Si Meta te ofrece **coexistencia** (seguir usando la app WhatsApp Business en el mismo
     número), úsala: mantienes el +51 914 300 593 que ya está en el sitio.
   - Si no, el número pasa a ser solo API (deja de funcionar en la app). En ese caso usa un
     número nuevo y cámbialo en `src/lib/site.ts` (`phone`).
   - Copia el **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. **Token permanente:** Business Manager → *Usuarios del sistema* → crea uno (admin) → asígnale
   la app y la cuenta de WhatsApp → *Generar token* con permisos `whatsapp_business_messaging`
   y `whatsapp_business_management` → `WHATSAPP_TOKEN`. (El token temporal de 24 h no sirve.)
4. **App secret:** app de Meta → *Configuración → Básica* → *Clave secreta* → `WHATSAPP_APP_SECRET`.
5. **Verify token:** inventa una cadena larga (ej. con un gestor de contraseñas) → `WHATSAPP_VERIFY_TOKEN`.
6. **Vercel:** carga las 4 variables en *Production* y vuelve a desplegar.
7. **Webhook:** app de Meta → *WhatsApp → Configuración* → *Webhook*:
   - URL de devolución: `https://xapiensys.com/api/whatsapp`
   - Token de verificación: el mismo `WHATSAPP_VERIFY_TOKEN` → *Verificar y guardar*.
   - Suscríbete al campo **messages**.
8. **Prueba:** desde otro celular escribe "Hola, mi código es XP-6365". Debe llegar la respuesta
   y el correo de aviso.

## Costos

Responder dentro de las 24 h siguientes a un mensaje del cliente es una conversación de servicio,
gratuita según la tarifa de Meta vigente al escribir esto (revisa la tarifa actual en Meta).
El bot solo responde a quien escribe primero: nunca inicia conversaciones.
