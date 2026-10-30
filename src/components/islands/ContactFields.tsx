/** Campos de contacto compartidos por el cotizador y el chat (nombre, empresa, WhatsApp, email, consentimiento). */

export interface ContactValues {
  name: string;
  company: string;
  phone: string;
  email: string;
  consent: boolean;
  website: string;
}

export const emptyContact: ContactValues = {
  name: '',
  company: '',
  phone: '',
  email: '',
  consent: false,
  website: '',
};

interface Props {
  idPrefix: string;
  values: ContactValues;
  onChange: (v: ContactValues) => void;
  showEmail?: boolean;
  companyLabel?: string;
}

export function ContactFields({
  idPrefix,
  values,
  onChange,
  showEmail = true,
  companyLabel = 'Empresa o negocio',
}: Props) {
  const set = (key: keyof ContactValues) => (e: Event) => {
    const t = e.currentTarget as HTMLInputElement;
    onChange({ ...values, [key]: t.type === 'checkbox' ? t.checked : t.value });
  };
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div class="xf-fields">
      <div class="xf-field">
        <label for={id('name')}>Nombre</label>
        <input
          id={id('name')}
          name="name"
          autocomplete="name"
          required
          minLength={2}
          maxLength={80}
          value={values.name}
          onInput={set('name')}
        />
      </div>
      <div class="xf-field">
        <label for={id('company')}>
          {companyLabel} <span class="xf-optional">(opcional)</span>
        </label>
        <input
          id={id('company')}
          name="company"
          autocomplete="organization"
          maxLength={120}
          value={values.company}
          onInput={set('company')}
        />
      </div>
      <div class="xf-field">
        <label for={id('phone')}>WhatsApp</label>
        <input
          id={id('phone')}
          name="phone"
          type="tel"
          inputMode="tel"
          autocomplete="tel"
          required
          pattern="\+?[\d\s()\-]{7,20}"
          placeholder="+51 9XX XXX XXX"
          value={values.phone}
          onInput={set('phone')}
        />
      </div>
      {showEmail && (
        <div class="xf-field">
          <label for={id('email')}>
            Email <span class="xf-optional">(opcional)</span>
          </label>
          <input
            id={id('email')}
            name="email"
            type="email"
            autocomplete="email"
            maxLength={160}
            value={values.email}
            onInput={set('email')}
          />
        </div>
      )}
      {/* Honeypot: invisible para personas, los bots suelen llenarlo. */}
      <div class="xf-hp" aria-hidden="true">
        <label for={id('website')}>Sitio web</label>
        <input
          id={id('website')}
          name="website"
          tabIndex={-1}
          autocomplete="off"
          value={values.website}
          onInput={set('website')}
        />
      </div>
      <div class="xf-check">
        <input
          id={id('consent')}
          name="consent"
          type="checkbox"
          required
          checked={values.consent}
          onChange={set('consent')}
        />
        <label for={id('consent')}>
          Acepto que Xapiensys use mis datos para responder mi consulta, según la{' '}
          <a href="/privacidad" target="_blank" rel="noopener">
            política de privacidad
          </a>{' '}
          (Ley 29733).
        </label>
      </div>
    </div>
  );
}
