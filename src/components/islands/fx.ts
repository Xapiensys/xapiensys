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

  // Aparición al entrar en pantalla (se marca por JS: sin JS todo queda visible).
  // Cascada por grupo: los hermanos aparecen uno tras otro; imágenes con zoom.
  const targets = document.querySelectorAll<HTMLElement>(
    [
      'main .section-heading',
      'main .card',
      'main details',
      'main .chat',
      'main ol > li',
      'main .metrics > div',
      'main .chips > li',
      'main figure',
      'main .visual',
      'main table tr',
      'main .final .inner',
    ].join(', '),
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
  targets.forEach((el) => {
    // Lo que ya está a la vista al cargar no se oculta (evita parpadeo y no afecta al LCP).
    if (el.getBoundingClientRect().top < innerHeight) return;
    const siblings = el.parentElement ? [...el.parentElement.children] : [el];
    const order = Math.max(0, siblings.indexOf(el));
    el.setAttribute('data-reveal', el.matches('figure, .visual') ? 'zoom' : '');
    el.style.setProperty('--reveal-delay', `${Math.min(order, 6) * 0.07}s`);
    io.observe(el);
  });

  // Contadores: las métricas medidas suben desde 0 al entrar en pantalla.
  const counters = document.querySelectorAll<HTMLElement>('main .metrics dd');
  const co = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        co.unobserve(e.target);
        const el = e.target as HTMLElement;
        const final = el.textContent ?? '';
        const match = /^([\d.]+)(.*)$/.exec(final.trim());
        if (!match) continue;
        const target = Number(match[1]);
        const decimals = (match[1]!.split('.')[1] ?? '').length;
        const suffix = match[2] ?? '';
        const start = performance.now();
        const dur = 1100;
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = `${(target * eased).toFixed(decimals)}${suffix}`;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = final;
        };
        requestAnimationFrame(step);
      }
    },
    { threshold: 0.6 },
  );
  counters.forEach((c) => co.observe(c));

  // Parallax suave de las imágenes grandes (héroes de página y CTA final).
  const layers = [
    ...document.querySelectorAll<HTMLElement>('.page-hero .visual img, .final .visual img'),
  ];
  if (layers.length) {
    let ticking = false;
    const move = () => {
      for (const img of layers) {
        const r = img.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const offset = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        img.style.transform = `scale(1.08) translateY(${(-offset * 18).toFixed(1)}px)`;
      }
      ticking = false;
    };
    addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(move);
        }
      },
      { passive: true },
    );
    move();
  }

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
