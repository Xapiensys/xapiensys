/**
 * Interacciones ligeras (sin dependencias): aparición al hacer scroll, barra de progreso,
 * inclinación de tarjetas, botones magnéticos, luz bajo el cursor y enlace activo del menú.
 * Todo se apaga con `prefers-reduced-motion`; el contenido nunca depende de esto para verse.
 */
export function bootFx(): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Barra de progreso de lectura
  const bar = document.querySelector<HTMLElement>('.scroll-progress');
  if (bar) {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      ticking = false;
    };
    addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true },
    );
    update();
  }

  // Enlace activo del menú según la sección visible
  const links = [...document.querySelectorAll<HTMLAnchorElement>('header nav a[href^="#"]')];
  const sections = links
    .map((a) => document.querySelector<HTMLElement>(a.getAttribute('href') ?? ''))
    .filter((s): s is HTMLElement => !!s);
  if (sections.length) {
    const so = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          links.forEach((a) =>
            a.toggleAttribute('data-active', a.getAttribute('href') === `#${e.target.id}`),
          );
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((s) => so.observe(s));
  }

  if (reduced) return;

  // Aparición al entrar en pantalla (se marca por JS: sin JS todo queda visible)
  const targets = document.querySelectorAll<HTMLElement>(
    'main .section-heading, main .card, main details, main .chat-window, main ol > li',
  );
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  targets.forEach((el, i) => {
    // Lo que ya está a la vista al cargar no se oculta (evita parpadeo y no afecta al LCP).
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.setAttribute('data-reveal', '');
    el.style.setProperty('--reveal-delay', `${(i % 4) * 0.08}s`);
    io.observe(el);
  });

  if (!fine) return;

  // Luz que sigue al cursor
  const glow = document.querySelector<HTMLElement>('.cursor-glow');
  if (glow) {
    let gx = 0;
    let gy = 0;
    let tx = 0;
    let ty = 0;
    let on = false;
    addEventListener(
      'pointermove',
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        if (!on) {
          on = true;
          glow.classList.add('is-on');
        }
      },
      { passive: true },
    );
    const tick = () => {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  // Tarjetas: inclinación suave y brillo bajo el cursor
  document.querySelectorAll<HTMLElement>('main .card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });

  // Botones magnéticos
  document
    .querySelectorAll<HTMLElement>('main a.button, header a.button, .button')
    .forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.transform = '';
      });
    });
}
