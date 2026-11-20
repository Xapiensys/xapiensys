/**
 * Normaliza teléfonos a formato internacional (E.164, ej. `+527761538921`) para que
 * los enlaces `wa.me` funcionen también con clientes fuera del Perú.
 *
 * Orden de decisión:
 * 1. Si el número trae `+` o `00`, ya es internacional.
 * 2. Si coincide con el largo nacional del país detectado por IP (`x-vercel-ip-country`),
 *    se antepone su código.
 * 3. Si ya empieza por el código del país con el largo correcto, se respeta.
 * 4. Sin país: 9 dígitos que empiezan en 9 → Perú (comportamiento histórico).
 */

interface CountryDial {
  dial: string;
  /** Largos válidos del número nacional (sin 0 troncal). */
  lengths: number[];
  /** Prefijo móvil que WhatsApp exige tras el código (Argentina: 9). */
  mobile?: string;
}

const countries: Record<string, CountryDial> = {
  PE: { dial: '51', lengths: [9] },
  MX: { dial: '52', lengths: [10] },
  CO: { dial: '57', lengths: [10] },
  CL: { dial: '56', lengths: [9] },
  AR: { dial: '54', lengths: [10], mobile: '9' },
  EC: { dial: '593', lengths: [9] },
  BO: { dial: '591', lengths: [8] },
  VE: { dial: '58', lengths: [10] },
  UY: { dial: '598', lengths: [8] },
  PY: { dial: '595', lengths: [9] },
  CR: { dial: '506', lengths: [8] },
  PA: { dial: '507', lengths: [8] },
  GT: { dial: '502', lengths: [8] },
  DO: { dial: '1', lengths: [10] },
  US: { dial: '1', lengths: [10] },
  CA: { dial: '1', lengths: [10] },
  ES: { dial: '34', lengths: [9] },
};

export function normalizePhone(raw: string, country?: string | null): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;

  const info = country ? countries[country.toUpperCase()] : undefined;
  if (info) {
    const national = digits.replace(/^0+/, '');
    if (info.lengths.includes(national.length))
      return `+${info.dial}${info.mobile ?? ''}${national}`;
    const rest = digits.slice(info.dial.length);
    if (digits.startsWith(info.dial) && info.lengths.includes(rest.replace(/^9/, '').length))
      return `+${digits}`;
  }
  if (digits.length === 9 && digits.startsWith('9')) return `+51${digits}`;
  // Sin datos para decidir: se guarda tal cual (puede incluir ya el código de país).
  return digits.length > 10 ? `+${digits}` : trimmed;
}

/** Dígitos para `wa.me/<dígitos>`; también acepta números antiguos guardados sin `+`. */
export function waDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return digits;
  return digits.length === 9 ? `51${digits}` : digits;
}
