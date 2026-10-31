/**
 * NAP (nombre, dirección, teléfono) y datos de marca: fuente única.
 * Header, Footer, Schema.org y WhatsApp leen de aquí.
 */
export const site = {
  name: 'Xapiensys',
  legalName: 'Xapiensys', // TODO(xapiensys): razón social y RUC para /privacidad y Schema.
  alternateNames: ['Xapiens', 'Xapiensis', 'Xapiensys Perú'],
  url: 'https://xapiensys.com',
  tagline: 'Ingeniería web, automatización e IA para empresas.',
  description:
    'Xapiensys crea páginas web rápidas, chatbots con IA y automatización de procesos para empresas en Lima, Perú y Latinoamérica.',
  // TODO(xapiensys): reemplazar por el correo de dominio (ej. contacto@xapiensys.com) cuando exista.
  email: 'xapiensys@gmail.com',
  phone: {
    display: '+51 914 300 593',
    e164: '+51914300593',
    schema: '+51-914-300-593',
    whatsapp: '51914300593',
  },
  address: {
    locality: 'Lima',
    region: 'Lima',
    country: 'PE',
    countryName: 'Perú',
  },
  areaServed: ['Lima', 'Perú', 'Latinoamérica'],
  priceRange: 'S/ 1,500 – S/ 3,500+',
  knowsAbout: [
    'Desarrollo web',
    'Chatbots con inteligencia artificial',
    'Automatización de procesos',
    'Sistemas a medida',
    'SEO técnico',
  ],
  // TODO(xapiensys): confirmar que cada perfil existe y enlaza a xapiensys.com.
  // El usuario de Instagram (jinfaxtech) no coincide con la marca.
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/jinfaxtech/' },
    { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61574070666802' },
    { name: 'GitHub', url: 'https://github.com/Xapiensys-com' },
  ],
  googleSiteVerification: 'p3S19uGZlClLbqNKLQYBV9NlXXAMnWxUeEkdXt46b7k',
  locale: 'es-PE',
  ogLocale: 'es_PE',
} as const;

export const absoluteUrl = (path: string): string => new URL(path, site.url).toString();

export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: 'Servicios', href: '/servicios' },
  { label: 'Soluciones', href: '/soluciones' },
  { label: 'Proyectos', href: '/proyectos' },
  { label: 'Empresa', href: '/empresa' },
];
