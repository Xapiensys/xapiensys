/**
 * Búsqueda de música para el reproductor (Radio Tommy). Usa la API pública de iTunes:
 * devuelve fragmentos oficiales de 30 s (uso promocional permitido) y el enlace a la
 * canción completa en Apple Music. No requiere clave.
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { rateLimit } from '@/lib/server/rateLimit';
import { clientIp, fail, hashIp, log } from '@/lib/server/http';

export const prerender = false;

const querySchema = z.string().trim().min(2).max(80);

type ItunesTrack = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

export type MusicTrack = {
  id: number;
  title: string;
  artist: string;
  preview: string;
  artwork: string;
  url: string;
};

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });

export const GET: APIRoute = async ({ request, url }) => {
  const parsed = querySchema.safeParse(url.searchParams.get('q') ?? '');
  if (!parsed.success) return fail('invalid_input', 422);

  const ipHash = await hashIp(clientIp(request));
  if (!(await rateLimit(`${ipHash}:music`, 60, 60 * 60 * 1000))) {
    return json({ tracks: [], limited: true }, 429);
  }

  const api = new URL('https://itunes.apple.com/search');
  api.search = new URLSearchParams({
    term: parsed.data,
    media: 'music',
    entity: 'song',
    limit: '15',
    country: 'PE',
  }).toString();

  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`itunes ${res.status}`);
    const data = (await res.json()) as { results?: ItunesTrack[] };
    const tracks: MusicTrack[] = (data.results ?? [])
      .filter((t) => t.previewUrl?.startsWith('https://') && t.trackId && t.trackName)
      .map((t) => ({
        id: t.trackId!,
        title: t.trackName!,
        artist: t.artistName ?? '',
        preview: t.previewUrl!,
        artwork: (t.artworkUrl100 ?? '').replace('100x100bb', '300x300bb'),
        url: t.trackViewUrl ?? '',
      }));
    // Las búsquedas iguales se sirven desde la CDN un día.
    return json({ tracks }, 200, 'public, s-maxage=86400, stale-while-revalidate=604800');
  } catch (error) {
    log('api/music', error);
    return json({ tracks: [], error: true }, 502);
  }
};

export const ALL: APIRoute = () => fail('method_not_allowed', 405, { allow: 'GET' });
