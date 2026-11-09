/**
 * Radio Tommy: reproductor flotante. Empieza en silencio (nunca suena solo), busca cualquier
 * artista, canción o género vía /api/music (fragmentos oficiales de 30 s de iTunes) y avanza
 * solo por la lista. Tommy (el chat) lo controla con el evento `tommy:music`.
 * Mientras suena, un analizador de audio mueve el ecualizador y un brillo sutil (--beat).
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { track as trackEvent } from '@/lib/analytics';
import './styles/music.css';

type Track = {
  id: number;
  title: string;
  artist: string;
  preview: string;
  artwork: string;
  url: string;
};

export const MUSIC_EVENT = 'tommy:music';

/** Etiqueta visible → búsqueda real (más precisa que el texto de la etiqueta). */
const SUGGESTIONS = [
  { label: 'House elegante', q: 'deep house' },
  { label: 'Lo-fi para trabajar', q: 'lofi hip hop' },
  { label: 'Salsa clásica', q: 'Héctor Lavoe' },
  { label: 'Cumbia peruana', q: 'Grupo 5' },
  { label: 'Rock en español', q: 'Soda Stereo' },
  { label: 'Jazz suave', q: 'smooth jazz' },
  { label: 'Peggy Gou', q: 'Peggy Gou' },
  { label: 'Fred again..', q: 'Fred again..' },
  { label: 'Música criolla', q: 'Eva Ayllón' },
  { label: 'Reggaetón', q: 'Bad Bunny' },
];

const BARS = 7;

function readVolume(): number {
  try {
    const v = Number(localStorage.getItem('xp_volume'));
    return v > 0 && v <= 1 ? v : 0.7;
  } catch {
    return 0.7;
  }
}

export default function MusicPlayer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef(0);
  const barsRef = useRef<HTMLElement[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const current = index >= 0 ? tracks[index] : undefined;

  // Audio único para toda la página.
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';
    const v = readVolume();
    audio.volume = v;
    setVolume(v);
    audioRef.current = audio;
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  /** Analizador para el ecualizador (necesita un gesto previo del usuario). */
  const ensureAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // Sin analizador el audio suena igual; el ecualizador queda en modo animado.
    }
  }, []);

  // Bucle del ecualizador y del brillo rítmico de la página.
  useEffect(() => {
    const root = document.documentElement;
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      root.style.setProperty('--beat', '0');
      root.removeAttribute('data-music');
      barsRef.current.forEach((b) => b.style.removeProperty('--lvl'));
      return;
    }
    root.setAttribute('data-music', 'on');
    const analyser = analyserRef.current;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0;
    const loop = () => {
      t += 1;
      let levels: number[];
      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        levels = Array.from({ length: BARS }, (_, i) => {
          const from = Math.floor((i / BARS) * data.length * 0.7);
          return (data[from] ?? 0) / 255;
        });
      } else {
        levels = Array.from(
          { length: BARS },
          (_, i) => 0.35 + 0.3 * Math.abs(Math.sin(t / 9 + i * 1.3)),
        );
      }
      barsRef.current.forEach((b, i) =>
        b.style.setProperty('--lvl', String(Math.max(0.12, levels[i % BARS] ?? 0))),
      );
      if (!reduced) root.style.setProperty('--beat', ((levels[0] ?? 0) * 0.9).toFixed(2));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const playAt = useCallback(
    async (list: Track[], i: number) => {
      const audio = audioRef.current;
      const t = list[i];
      if (!audio || !t) return;
      ensureAnalyser();
      if (ctxRef.current?.state === 'suspended') await ctxRef.current.resume();
      setIndex(i);
      setProgress(0);
      audio.src = t.preview;
      try {
        await audio.play();
        setError('');
      } catch {
        setError('Toca ▶ para reproducir.');
      }
    },
    [ensureAnalyser],
  );

  // Siguiente canción al terminar el fragmento.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (tracks.length) void playAt(tracks, (index + 1) % tracks.length);
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [tracks, index, playAt]);

  const search = useCallback(
    async (raw: string, source: string) => {
      const q = raw.trim().slice(0, 80);
      if (q.length < 2) return;
      setLoading(true);
      setError('');
      setLastQuery(q);
      trackEvent('music_play', { source, query: q });
      try {
        const res = await fetch(`/api/music?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { tracks?: Track[]; limited?: boolean };
        const list = data.tracks ?? [];
        if (!list.length) {
          setError(
            data.limited
              ? 'Muchas búsquedas seguidas. Prueba en unos minutos.'
              : `No encontré «${q}». Prueba otra búsqueda.`,
          );
          return;
        }
        setTracks(list);
        await playAt(list, 0);
      } catch {
        setError('No pude conectar con la música. Prueba de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    [playAt],
  );

  // Tommy (el chat) o cualquier botón con data-music="búsqueda" ponen música.
  useEffect(() => {
    const onMusic = (e: Event) => {
      const q = (e as CustomEvent<{ query?: string }>).detail?.query;
      if (q) void search(q, 'tommy');
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-music]');
      if (!el?.dataset.music) return;
      e.preventDefault();
      setOpen(true);
      void search(el.dataset.music, 'link');
    };
    window.addEventListener(MUSIC_EVENT, onMusic);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener(MUSIC_EVENT, onMusic);
      document.removeEventListener('click', onClick);
    };
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) {
      void search(SUGGESTIONS[0]!.q, 'toggle');
      return;
    }
    if (audio.paused) {
      ensureAnalyser();
      void ctxRef.current?.resume();
      void audio.play().catch(() => setError('Toca ▶ para reproducir.'));
    } else audio.pause();
  };

  const step = (dir: 1 | -1) => {
    if (!tracks.length) return;
    void playAt(tracks, (index + dir + tracks.length) % tracks.length);
  };

  const onVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    try {
      localStorage.setItem('xp_volume', String(v));
    } catch {
      // Sin almacenamiento: el volumen se reinicia en la próxima visita.
    }
  };

  const seek = (e: MouseEvent) => {
    const audio = audioRef.current;
    const bar = e.currentTarget as HTMLElement;
    if (!audio?.duration) return;
    const r = bar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  };

  const equalizer = (cls: string) => (
    <span class={`eq ${cls}`} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <i
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i + (cls === 'eq-panel' ? BARS : 0)] = el;
          }}
        />
      ))}
    </span>
  );

  return (
    <>
      <button
        type="button"
        class={`music-launcher${playing ? ' is-playing' : ''}${open ? ' is-hidden' : ''}`}
        aria-expanded={open}
        aria-controls="music-panel"
        aria-label={
          current && playing ? `Música: ${current.title} de ${current.artist}` : 'Poner música'
        }
        onClick={() => setOpen(true)}
      >
        {equalizer('eq-launcher')}
        <span class="music-launcher-text">
          {current && playing ? (
            <>
              <strong>{current.title}</strong>
              <small>{current.artist}</small>
            </>
          ) : (
            <>
              <strong>Música</strong>
              <small>Pon tu canción</small>
            </>
          )}
        </span>
      </button>

      <div
        id="music-panel"
        ref={panelRef}
        class={`music-panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-label="Reproductor de música Radio Tommy"
        hidden={!open}
      >
        <div class="music-head">
          {equalizer('eq-panel')}
          <div>
            <strong>Radio Tommy</strong>
            <small class="mono">LO QUE QUIERAS ESCUCHAR</small>
          </div>
          <button
            type="button"
            class="music-close"
            aria-label="Cerrar reproductor"
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form
          class="music-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query, 'search');
          }}
        >
          <label class="visually-hidden" for="music-q">
            Buscar artista, canción o género
          </label>
          <input
            ref={inputRef}
            id="music-q"
            type="search"
            maxLength={80}
            autocomplete="off"
            placeholder="Artista, canción o género…"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          <button type="submit" disabled={loading || query.trim().length < 2}>
            {loading ? '…' : 'Poner'}
          </button>
        </form>

        <div class="music-chips" aria-label="Sugerencias">
          {SUGGESTIONS.map((s) => (
            <button
              type="button"
              key={s.label}
              class={lastQuery === s.q ? 'is-active' : ''}
              onClick={() => void search(s.q, 'suggestion')}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && (
          <p class="music-error" role="status">
            {error}
          </p>
        )}

        {current && (
          <div class="music-now">
            {current.artwork && (
              <img src={current.artwork} alt="" width={64} height={64} loading="lazy" />
            )}
            <div class="music-meta">
              <strong>{current.title}</strong>
              <span>{current.artist}</span>
              <div
                class="music-progress"
                role="progressbar"
                aria-label="Avance del fragmento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                onClick={seek}
              >
                <i style={{ transform: `scaleX(${progress})` }} />
              </div>
            </div>
          </div>
        )}

        <div class="music-controls">
          <button type="button" aria-label="Anterior" onClick={() => step(-1)} disabled={!current}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 6v12M18 6l-8 6 8 6V6Z" />
            </svg>
          </button>
          <button
            type="button"
            class="music-play"
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            onClick={toggle}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14M16 5v14" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 5l12 7-12 7V5Z" />
              </svg>
            )}
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => step(1)} disabled={!current}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17 6v12M6 6l8 6-8 6V6Z" />
            </svg>
          </button>
          <label class="music-volume">
            <span class="visually-hidden">Volumen</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onInput={(e) => onVolume(Number(e.currentTarget.value))}
            />
          </label>
        </div>

        {tracks.length > 1 && (
          <ol class="music-list" aria-label={`Resultados para ${lastQuery}`}>
            {tracks.slice(0, 8).map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  class={i === index ? 'is-current' : ''}
                  onClick={() => void playAt(tracks, i)}
                >
                  <span>{t.title}</span>
                  <small>{t.artist}</small>
                </button>
              </li>
            ))}
          </ol>
        )}

        <p class="music-note">
          Fragmentos oficiales de 30 s vía Apple Music.
          {current?.url && (
            <>
              {' '}
              <a href={current.url} target="_blank" rel="noopener noreferrer">
                Escuchar completa ↗
              </a>
            </>
          )}
        </p>
      </div>
    </>
  );
}
