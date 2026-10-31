import type { APIRoute, GetStaticPaths } from 'astro';
import { getOgPages, type OgPage } from '@/lib/ogPages';
import { renderOg } from '@/lib/og';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () =>
  (await getOgPages()).map((page) => ({ params: { slug: page.slug }, props: { page } }));

export const GET: APIRoute<{ page: OgPage }> = async ({ props }) => {
  const png = await renderOg(props.page);
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } });
};
