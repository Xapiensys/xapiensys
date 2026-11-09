/**
 * Asistente IA flotante en todas las páginas. El botón pesa casi nada; el chat (ChatDemo)
 * se descarga recién al abrirlo. Cualquier elemento con `data-open-assistant` lo abre.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import type { GuidedTopic } from '@/lib/chatGuided';
import { track } from '@/lib/analytics';
import './styles/dock.css';

interface Props {
  suggestions: string[];
  guided: GuidedTopic[];
  avatarSrc?: string;
}

type ChatProps = Props & { idPrefix: string; variant: 'dock' };

export default function AssistantDock({ suggestions, guided, avatarSrc }: Props) {
  const [open, setOpen] = useState(false);
  const [Chat, setChat] = useState<ComponentType<ChatProps> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    if (Chat) return;
    void import('./ChatDemo').then((m) => setChat(() => m.default));
  }, [Chat]);

  const show = useCallback(
    (location: string) => {
      load();
      setOpen(true);
      track('assistant_open', { location });
    },
    [load],
  );

  const hide = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  // Botones del sitio con data-open-assistant (hero, servicios, CTA final).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-open-assistant]');
      if (!el) return;
      e.preventDefault();
      show(el.dataset.openAssistant || 'link');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [show]);

  // Escape cierra; al abrir, el foco va al campo de texto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  useEffect(() => {
    if (!open || !Chat) return;
    const t = window.setTimeout(
      () => panelRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus(),
      60,
    );
    return () => window.clearTimeout(t);
  }, [open, Chat]);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        class={`dock-launcher${open ? ' is-hidden' : ''}`}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label="Habla con Tommy, el asistente con IA"
        onPointerEnter={load}
        onFocus={load}
        onClick={() => show('float')}
      >
        <span class="dock-core" aria-hidden="true">
          <i />
          {avatarSrc ? (
            <img src={avatarSrc} alt="" width={48} height={48} />
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M4 5.5h16v10.5H10l-6 4.5V5.5Z" />
              <path d="M8.5 10.75h.01M12 10.75h.01M15.5 10.75h.01" />
            </svg>
          )}
          <b class="dock-online" />
        </span>
        <span class="dock-text">
          <strong>Habla con Tommy</strong>
          <small>IA · responde en segundos</small>
        </span>
      </button>

      <div
        id="assistant-panel"
        ref={panelRef}
        class={`dock-panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-label="Tommy, asistente con IA de Xapiensys"
        hidden={!open}
      >
        <button type="button" class="dock-close" aria-label="Cerrar asistente" onClick={hide}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {Chat ? (
          <Chat
            suggestions={suggestions}
            guided={guided}
            idPrefix="dock"
            variant="dock"
            {...(avatarSrc ? { avatarSrc } : {})}
          />
        ) : (
          <div class="dock-loading" aria-busy="true">
            <span class="dock-core" aria-hidden="true">
              <i />
            </span>
            Conectando con Tommy…
          </div>
        )}
      </div>
    </>
  );
}
