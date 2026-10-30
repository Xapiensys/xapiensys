/** OG images por página, generadas en build (SVG → PNG con satori + sharp). Solo build. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

const fontDir = join(process.cwd(), 'node_modules/@fontsource');
let fonts: { name: string; data: Buffer; weight: 400 | 600; style: 'normal' }[] | null = null;

async function loadFonts() {
  fonts ??= [
    {
      name: 'Space Grotesk',
      data: await readFile(
        join(fontDir, 'space-grotesk/files/space-grotesk-latin-600-normal.woff'),
      ),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'Inter',
      data: await readFile(join(fontDir, 'inter/files/inter-latin-400-normal.woff')),
      weight: 400,
      style: 'normal',
    },
  ];
  return fonts;
}

// Mismos valores que tokens.css (satori no lee CSS).
const C = {
  bg: '#0a0a0f',
  surface: '#11111a',
  cyan: '#00f0ff',
  violet: '#7c3aed',
  text: '#e8ecf5',
  muted: '#8a94a8',
};

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

export async function renderOg({
  title,
  label,
}: {
  title: string;
  label: string;
}): Promise<Buffer> {
  const mark = {
    type: 'svg',
    props: {
      width: 64,
      height: 64,
      viewBox: '0 0 48 48',
      children: [
        {
          type: 'path',
          props: { d: 'M7 7 41 41M41 7 7 41', stroke: C.cyan, 'stroke-width': 3.5, fill: 'none' },
        },
        {
          type: 'path',
          props: {
            d: 'M24 4v40M4 24h40',
            stroke: C.cyan,
            'stroke-width': 1,
            opacity: 0.55,
            fill: 'none',
          },
        },
        { type: 'circle', props: { cx: 24, cy: 24, r: 3, fill: C.cyan } },
      ],
    },
  };

  const tree = h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 72px',
      background: `radial-gradient(circle at 85% 20%, rgba(124,58,237,0.28), transparent 45%), radial-gradient(circle at 10% 90%, rgba(0,240,255,0.16), transparent 40%), ${C.bg}`,
      color: C.text,
      fontFamily: 'Inter',
      border: `1px solid ${C.surface}`,
    },
    [
      h('div', { display: 'flex', alignItems: 'center', gap: 20 }, [
        mark,
        h(
          'div',
          { fontFamily: 'Space Grotesk', fontSize: 28, letterSpacing: 6, fontWeight: 600 },
          'XAPIENSYS',
        ),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: 24 }, [
        h('div', { fontSize: 22, color: C.muted, letterSpacing: 4 }, label.toUpperCase()),
        h(
          'div',
          {
            fontFamily: 'Space Grotesk',
            fontSize: title.length > 48 ? 58 : 70,
            fontWeight: 600,
            lineHeight: 1.04,
            letterSpacing: -2,
            maxWidth: 1000,
          },
          title,
        ),
      ]),
      h('div', { display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.muted }, [
        h('div', { display: 'flex' }, 'Web · Automatización · IA'),
        h('div', { display: 'flex', color: C.cyan }, 'xapiensys.com'),
      ]),
    ],
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: await loadFonts(),
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
}
