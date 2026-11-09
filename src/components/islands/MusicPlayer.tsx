/**
 * Radio Tommy: reproductor flotante. Nunca suena solo: empieza en silencio.
 * Tres estados: botón (cerrado), panel completo y barra mini (minimizado, no estorba).
 * Dos motores:
 *  - YouTube (canción completa, reproductor oficial siempre visible) si /api/music lo ofrece.
 *  - Audio (fragmento de 30 s de iTunes) como respaldo; con analizador real para el ecualizador.
 * Tommy (el chat) lo controla con el evento `tommy:music`; cualquier [data-music="…"] también.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { track as trackEvent } from '@/lib/analytics';
import './styles/music.css';

type Track = {
  id: string;
  source: 'youtube' | 'preview';
  title: string;
  artist: string;
  media: string;
  artwork: string;
  url: string;
};

type View = 'closed' | 'open' | 'mini';

export const MUSIC_EVENT = 'tommy:music';

/** Etiqueta visible → búsqueda real (más precisa que el texto de la etiqueta). */
const SUGGESTIONS = [
  { label: 'House elegante', q: 'deep house mix' },
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

const fmt = (s: number) =>
  Number.isFinite(s) && s > 0
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    : '0:00';

/* ---------- YouTube IFrame API (se carga solo la primera vez que hace falta) ---------- */

type YTPlayer = {
  loadVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allow: boolean): void;
  setVolume(v: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      width?: string;
      height?: string;
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApi: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytApi ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      ytApi = null;
      reject(new Error('youtube_api'));
    };
    document.head.appendChild(s);
  });
  return ytApi;
}

/* --------------------------------------------------------------------------------------- */

export default function MusicPlayer() {
  const [view, setView] = useState<View>('closed');
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const barsRef = useRef<HTMLElement[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef({ tracks, index });
  stateRef.current = { tracks, index };

  const current = index >= 0 ? tracks[index] : undefined;
  const isYouTube = current?.source === 'youtube';

  // Audio único para los fragmentos.
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';
    const v = readVolume();
    audio.volume = v;
    setVolume(v);
    audioRef.current = audio;
    const onTime = () => {
      setTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => next();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Avance de YouTube (el reproductor no emite timeupdate).
  useEffect(() => {
    if (!isYouTube || !playing) return;
    const t = window.setInterval(() => {
      const p = ytRef.current;
      if (!p) return;
      setTime(p.getCurrentTime() || 0);
      setDuration(p.getDuration() || 0);
    }, 500);
    return () => window.clearInterval(t);
  }, [isYouTube, playing]);

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
      // Sin analizador suena igual; el ecualizador queda animado.
    }
  }, []);

  // Ecualizador + brillo rítmico. Con YouTube no hay acceso al audio: animación suave.
  useEffect(() => {
    const root = document.documentElement;
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      root.style.setProperty('--beat', '0');
      root.removeAttribute('data-music-playing');
      barsRef.current.forEach((b) => b.style.removeProperty('--lvl'));
      return;
    }
    root.setAttribute('data-music-playing', '');
    const analyser = isYouTube ? null : analyserRef.current;
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
          (_, i) => 0.3 + 0.55 * Math.abs(Math.sin(t / 8 + i * 1.3) * Math.cos(t / 23 + i)),
        );
      }
      barsRef.current.forEach((b, i) =>
        b.style.setProperty('--lvl', String(Math.max(0.12, levels[i % BARS] ?? 0))),
      );
      if (!reduced) root.style.setProperty('--beat', ((levels[0] ?? 0) * 0.8).toFixed(2));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, isYouTube]);

  const stopAll = () => {
    audioRef.current?.pause();
    ytRef.current?.pauseVideo();
  };

  /** Reproduce la pista i de la lista con el motor que corresponda. */
  const playAt = useCallback(
    async (list: Track[], i: number) => {
      const t = list[i];
      if (!t) return;
      setIndex(i);
      setTime(0);
      setDuration(0);
      setError('');

      if (t.source === 'youtube') {
        audioRef.current?.pause();
        try {
          const YT = await loadYouTube();
          if (!ytRef.current && ytHostRef.current) {
            const mount = document.createElement('div');
            ytHostRef.current.replaceChildren(mount);
            ytRef.current = new YT.Player(mount, {
              host: 'https://www.youtube-nocookie.com',
              width: '100%',
              height: '100%',
              videoId: t.media,
              playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
              events: {
                onReady: () => {
                  ytRef.current?.setVolume(Math.round(readVolume() * 100));
                  ytRef.current?.playVideo();
                },
                onStateChange: (e) => {
                  // 1 = sonando, 2 = pausa, 0 = terminó.
                  if (e.data === 1) setPlaying(true);
                  if (e.data === 2) setPlaying(false);
                  if (e.data === 0) next();
                },
                // Video no disponible o sin permiso de inserción: pasa al siguiente.
                onError: () => next(),
              },
            });
          } else {
            ytRef.current?.loadVideoById(t.media);
          }
        } catch {
          setError('No pude cargar YouTube. Prueba otra búsqueda.');
        }
        return;
      }

      ytRef.current?.pauseVideo();
      const audio = audioRef.current;
      if (!audio) return;
      ensureAnalyser();
      if (ctxRef.current?.state === 'suspended') await ctxRef.current.resume();
      audio.src = t.media;
      try {
        await audio.play();
      } catch {
        setError('Toca ▶ para reproducir.');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureAnalyser],
  );

  /** Siguiente/anterior leyendo el estado actual (lo usan eventos de los reproductores). */
  function next() {
    const { tracks: list, index: i } = stateRef.current;
    if (list.length) void playAt(list, (i + 1) % list.length);
  }
  function prev() {
    const { tracks: list, index: i } = stateRef.current;
    if (!list.length) return;
    // Si ya avanzó, "anterior" reinicia la canción, como en cualquier reproductor.
    if (time > 4) {
      seekTo(0);
      return;
    }
    void playAt(list, (i - 1 + list.length) % list.length);
  }

  const search = useCallback(
    async (raw: string, source: string) => {
      const q = raw.trim().slice(0, 80);
      if (q.length < 2) return;
      setLoading(true);
      setError('');
      setLastQuery(q);
      setView((v) => (v === 'closed' ? 'mini' : v));
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

  // Tommy (el chat) o cualquier [data-music="búsqueda"] ponen música.
  useEffect(() => {
    const onMusic = (e: Event) => {
      const q = (e as CustomEvent<{ query?: string }>).detail?.query;
      if (q) void search(q, 'tommy');
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('a[data-music], button[data-music]');
      if (!el?.dataset.music) return;
      e.preventDefault();
      setView('open');
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
    if (view !== 'open') return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView(current ? 'mini' : 'closed');
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [view, current]);

  const toggle = () => {
    if (!current) {
      void search(SUGGESTIONS[0]!.q, 'toggle');
      return;
    }
    if (isYouTube) {
      if (playing) ytRef.current?.pauseVideo();
      else ytRef.current?.playVideo();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      ensureAnalyser();
      void ctxRef.current?.resume();
      void audio.play().catch(() => setError('Toca ▶ para reproducir.'));
    } else audio.pause();
  };

  function seekTo(sec: number) {
    if (isYouTube) ytRef.current?.seekTo(sec, true);
    else if (audioRef.current) audioRef.current.currentTime = sec;
    setTime(sec);
  }

  const onVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    ytRef.current?.setVolume(Math.round(v * 100));
    try {
      localStorage.setItem('xp_volume', String(v));
    } catch {
      // Sin almacenamiento: el volumen se reinicia en la próxima visita.
    }
  };

  const closePlayer = () => {
    stopAll();
    setView('closed');
  };

  const equalizer = (cls: string, offset: number) => (
    <span class={`eq ${cls}`} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <i
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i + offset] = el;
          }}
        />
      ))}
    </span>
  );

  const seekBar = (
    <div class="music-seek">
      <span class="mono">{fmt(time)}</span>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        step={1}
        value={Math.min(Math.floor(time), Math.floor(duration) || 1)}
        aria-label="Adelantar o retroceder la canción"
        disabled={!current || !duration}
        onInput={(e) => seekTo(Number(e.currentTarget.value))}
      />
      <span class="mono">{fmt(duration)}</span>
    </div>
  );

  const controls = (size: 'sm' | 'lg') => (
    <div class={`music-controls music-controls-${size}`}>
      <button type="button" aria-label="Anterior" onClick={prev} disabled={!current}>
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
      <button type="button" aria-label="Siguiente" onClick={next} disabled={!current}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17 6v12M6 6l8 6-8 6V6Z" />
        </svg>
      </button>
    </div>
  );

  return (
    <>
      <button
        type="button"
        class={`music-launcher${view !== 'closed' ? ' is-hidden' : ''}`}
        aria-expanded={view === 'open'}
        aria-controls="music-panel"
        aria-label="Poner música"
        onClick={() => setView(current ? 'mini' : 'open')}
      >
        {equalizer('eq-launcher', 0)}
        <span class="music-launcher-text">
          <strong>Música</strong>
          <small>Pon tu canción</small>
        </span>
      </button>

      {/* Un solo contenedor para panel y barra mini: el video de YouTube no se recarga. */}
      <div
        id="music-panel"
        class={`music-panel is-${view}`}
        role="region"
        aria-label="Reproductor de música Radio Tommy"
        hidden={view === 'closed'}
      >
        {view === 'open' && (
          <div class="music-head">
            {equalizer('eq-panel', BARS)}
            <div>
              <strong>Radio Tommy</strong>
              <small class="mono">LO QUE QUIERAS ESCUCHAR</small>
            </div>
            <button
              type="button"
              class="music-icon-btn"
              aria-label="Minimizar reproductor"
              disabled={!current}
              onClick={() => setView('mini')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 15h12" />
              </svg>
            </button>
            <button
              type="button"
              class="music-icon-btn"
              aria-label="Cerrar y detener"
              onClick={closePlayer}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}

        {view === 'open' && (
          <>
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
          </>
        )}

        {error && (
          <p class="music-error" role="status">
            {error}
          </p>
        )}

        <div class="music-now">
          {/* Video oficial de YouTube (visible siempre, también minimizado) o carátula. */}
          <div class={`music-media${isYouTube ? ' is-video' : ''}`}>
            <div ref={ytHostRef} class="music-yt" hidden={!isYouTube} />
            {!isYouTube &&
              (current?.artwork ? (
                <img src={current.artwork} alt="" width={96} height={96} loading="lazy" />
              ) : (
                equalizer('eq-cover', BARS * 2)
              ))}
          </div>
          <div class="music-meta">
            <strong>
              {current ? current.title : loading ? 'Buscando…' : 'Elige qué escuchar'}
            </strong>
            <span>{current ? current.artist : 'Busca un artista o toca una sugerencia'}</span>
            {view === 'mini' && seekBar}
          </div>
          {view === 'mini' && (
            <div class="music-mini-actions">
              {controls('sm')}
              <button
                type="button"
                class="music-icon-btn"
                aria-label="Abrir reproductor"
                onClick={() => setView('open')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6-6 6 6M12 3v14" />
                </svg>
              </button>
              <button
                type="button"
                class="music-icon-btn"
                aria-label="Cerrar y detener"
                onClick={closePlayer}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {view === 'open' && (
          <>
            {seekBar}
            <div class="music-row">
              {controls('lg')}
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
                {tracks.slice(0, 12).map((t, i) => (
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
              {isYouTube
                ? 'Canciones completas con el reproductor oficial de YouTube.'
                : 'Fragmentos oficiales de 30 s vía Apple Music.'}
              {current?.url && (
                <>
                  {' '}
                  <a href={current.url} target="_blank" rel="noopener noreferrer">
                    {isYouTube ? 'Abrir en YouTube ↗' : 'Escuchar completa ↗'}
                  </a>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </>
  );
}
