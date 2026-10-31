/** Lista de OG images a generar: una por página indexable. */
import { getCollection } from 'astro:content';

export interface OgPage {
  slug: string;
  title: string;
  label: string;
}

export const ogPath = (slug: string) => `/og/${slug}.png`;

export async function getOgPages(): Promise<OgPage[]> {
  const [servicios, soluciones, proyectos] = await Promise.all([
    getCollection('servicios'),
    getCollection('soluciones'),
    getCollection('proyectos'),
  ]);
  return [
    {
      slug: 'servicios',
      title: 'Servicios de desarrollo web, IA y automatización',
      label: 'Servicios',
    },
    { slug: 'soluciones', title: 'Soluciones digitales por sector', label: 'Soluciones' },
    { slug: 'proyectos', title: 'Laboratorio de demos propias', label: 'Proyectos' },
    { slug: 'empresa', title: 'Ingeniería digital con base en Lima', label: 'Empresa' },
    { slug: 'cotizar', title: 'Cotiza tu proyecto en 1 minuto', label: 'Cotizador' },
    { slug: 'contacto', title: 'Conversemos sobre tu proyecto', label: 'Contacto' },
    {
      slug: 'diagnostico',
      title: 'Diagnóstico Digital Gratuito de 15 minutos',
      label: 'Diagnóstico digital',
    },
    ...servicios.map((s) => ({ slug: `servicios-${s.id}`, title: s.data.h1, label: 'Servicio' })),
    ...soluciones.map((s) => ({
      slug: `soluciones-${s.id}`,
      title: s.data.h1,
      label: `Sector · ${s.data.title}`,
    })),
    ...proyectos.map((p) => ({
      slug: `proyectos-${p.id}`,
      title: p.data.title,
      label: p.data.type === 'demo' ? 'Demo' : 'Caso',
    })),
  ];
}
