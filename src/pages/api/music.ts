/**
 * Búsqueda de música para Radio Tommy.
 * - Con YOUTUBE_API_KEY: YouTube Data API (categoría Música, solo videos insertables) →
 *   canciones completas con el reproductor oficial de YouTube.
 * - Sin clave o si YouTube falla: iTunes (fragmentos oficiales de 30 s, sin clave).
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { YOUTUBE_API_KEY } from 'astro:env/server';
import { rateLimit } from '@/lib/server/rateLimit';
import { clientIp, fail, hashIp, log } from '@/lib/server/http';

export const prerender = false;

const querySchema = z.string().trim().min(2).max(80);

export type MusicTrack = {
  id: string;
  source: 'youtube' | 'preview';
  title: string;
  artist: string;
  /** youtube: id del video · preview: URL del fragmento de audio. */
  media: string;
  artwork: string;
  url: string;
};

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });

/** Los títulos de YouTube llegan con entidades HTML (&amp;, &#39;…). */
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

type YtItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    liveBroadcastContent?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
  };
};

async function searchYouTube(q: string, key: string): Promise<MusicTrack[]> {
  const api = new URL('https://www.googleapis.com/youtube/v3/search');
  api.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'moderate',
    regionCode: 'PE',
    relevanceLanguage: 'es',
    maxResults: '15',
    q,
    key,
  }).toString();
  const res = await fetch(api, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) {
    // El motivo (sin la clave) ayuda a diagnosticar: accessNotConfigured, keyInvalid,
    // quotaExceeded, API_KEY_HTTP_REFERRER_BLOCKED…
    const body = (await res.json().catch(() => null)) as {
      error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] };
    } | null;
    const reason =
      body?.error?.details?.[0]?.reason ?? body?.error?.errors?.[0]?.reason ?? 'desconocido';
    throw new Error(`youtube ${res.status} ${reason}`);
  }
  const data = (await res.json()) as { items?: YtItem[] };
  return (data.items ?? [])
    .filter((i) => i.id?.videoId && i.snippet?.title && i.snippet.liveBroadcastContent === 'none')
    .map((i) => ({
      id: i.id!.videoId!,
      source: 'youtube' as const,
      title: decode(i.snippet!.title!),
      artist: decode(i.snippet!.channelTitle ?? '').replace(/ - Topic$/, ''),
      media: i.id!.videoId!,
      artwork: i.snippet!.thumbnails?.medium?.url ?? i.snippet!.thumbnails?.high?.url ?? '',
      url: `https://www.youtube.com/watch?v=${i.id!.videoId!}`,
    }));
}

type ItunesTrack = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

async function searchItunes(q: string): Promise<MusicTrack[]> {
  const api = new URL('https://itunes.apple.com/search');
  api.search = new URLSearchParams({
    term: q,
    media: 'music',
    entity: 'song',
    limit: '15',
    country: 'PE',
  }).toString();
  const res = await fetch(api, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  const data = (await res.json()) as { results?: ItunesTrack[] };
  return (data.results ?? [])
    .filter((t) => t.previewUrl?.startsWith('https://') && t.trackId && t.trackName)
    .map((t) => ({
      id: String(t.trackId),
      source: 'preview' as const,
      title: t.trackName!,
      artist: t.artistName ?? '',
      media: t.previewUrl!,
      artwork: (t.artworkUrl100 ?? '').replace('100x100bb', '300x300bb'),
      url: t.trackViewUrl ?? '',
    }));
}

export const GET: APIRoute = async ({ request, url }) => {
  const parsed = querySchema.safeParse(url.searchParams.get('q') ?? '');
  if (!parsed.success) return fail('invalid_input', 422);

  const ipHash = await hashIp(clientIp(request));
  if (!(await rateLimit(`${ipHash}:music`, 60, 60 * 60 * 1000))) {
    return json({ tracks: [], limited: true }, 429);
  }

  let tracks: MusicTrack[] = [];
  if (YOUTUBE_API_KEY) {
    try {
      tracks = await searchYouTube(parsed.data, YOUTUBE_API_KEY);
    } catch (error) {
      log('api/music.youtube', error);
    }
  }
  if (!tracks.length) {
    try {
      tracks = await searchItunes(parsed.data);
    } catch (error) {
      log('api/music.itunes', error);
      return json({ tracks: [], error: true }, 502);
    }
  }
  // Las búsquedas iguales se sirven desde la CDN un día (ahorra cuota de YouTube).
  return json({ tracks }, 200, 'public, s-maxage=86400, stale-while-revalidate=604800');
};

export const ALL: APIRoute = () => fail('method_not_allowed', 405, { allow: 'GET' });
