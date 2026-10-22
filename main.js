(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('#main-nav');
  const desktopQuery = window.matchMedia('(min-width: 900px)');

  if (menuButton && mainNav) {
    const setMenuOpen = (open) => {
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };

    menuButton.addEventListener('click', () => {
      setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
    });

    mainNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenuOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false);
        menuButton.focus();
      }
    });

    desktopQuery.addEventListener('change', (event) => {
      if (event.matches) setMenuOpen(false);
    });
  }

  const currentYear = document.querySelector('#current-year');
  if (currentYear) currentYear.textContent = String(new Date().getFullYear());

  const messages = document.querySelector('#chat-messages');
  const demoForm = document.querySelector('#demo-form');
  const demoInput = document.querySelector('#demo-input');
  const suggestionButtons = document.querySelectorAll('.chat-suggestions button[data-reply]');

  if (messages && demoForm && demoInput) {
    messages.style.maxHeight = 'min(420px, 48vh)';
    messages.style.overflowY = 'auto';
    messages.style.overscrollBehavior = 'contain';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const trimMessages = () => {
      while (messages.children.length > 14) messages.firstElementChild.remove();
    };

    const scrollChatToEnd = () => {
      messages.scrollTop = messages.scrollHeight;
    };

    const addMessage = (role, content) => {
      const message = document.createElement('div');
      message.className = `message ${role}`;

      if (role === 'agent') {
        const label = document.createElement('span');
        label.textContent = 'ASISTENTE';
        message.append(label);
      }

      if (typeof content === 'string') {
        message.append(document.createTextNode(content));
      } else {
        message.append(document.createTextNode(content.before));
        const link = document.createElement('a');
        link.href = 'https://wa.me/51914300593';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'WhatsApp';
        message.append(link, document.createTextNode(content.after));
      }

      messages.append(message);
      trimMessages();
      scrollChatToEnd();
    };

    const normalize = (value) => value
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const getReply = (message) => {
      const text = normalize(message);
      if (['precio', 'cotiz', 'costo'].some((word) => text.includes(word))) {
        return {
          before: 'Los precios dependen del alcance; escríbenos por ',
          after: ' para revisar tu caso.',
        };
      }
      if (['equipo', 'hablar', 'contacto'].some((word) => text.includes(word))) {
        return {
          before: 'Con gusto te orientamos. Puedes conversar con nuestro equipo por ',
          after: '.',
        };
      }
      if (['automat', 'proceso', 'python'].some((word) => text.includes(word))) {
        return 'Diseñamos automatizaciones que conectan tareas y herramientas para reducir el trabajo manual y dar más fluidez a tus procesos.';
      }
      if (['bot', 'chat', 'ia'].some((word) => text.includes(word))) {
        return 'Creamos chatbots con IA que responden consultas frecuentes y guían a tus clientes hacia el siguiente paso.';
      }
      if (['servicio', 'web', 'pagina'].some((word) => text.includes(word))) {
        return 'Desarrollamos páginas web rápidas, accesibles y optimizadas para que tus clientes encuentren información y contacten a tu empresa.';
      }
      return {
        before: 'Esta demo es local, pero podemos ayudarte a resolver tu consulta. Escríbenos por ',
        after: '.',
      };
    };

    const sendMessage = (value) => {
      const text = value.trim();
      if (!text) return;

      addMessage('user', text);
      const reply = getReply(text);
      window.setTimeout(() => addMessage('agent', reply), reducedMotion.matches ? 0 : 500);
    };

    suggestionButtons.forEach((button) => {
      button.addEventListener('click', () => sendMessage(button.dataset.reply || ''));
    });

    demoForm.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage(demoInput.value);
      demoInput.value = '';
    });
  }

  const canvas = document.querySelector('#bg');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let sceneState = null;
  let permanentlyDisabled = false;
  let resizeTimer = 0;
  let loadComplete = false;
  let initPending = false;

  const canRunCanvas = () => window.innerWidth >= 900
    && !motionQuery.matches
    && !navigator.connection?.saveData
    && navigator.hardwareConcurrency >= 4
    && canvas instanceof HTMLCanvasElement;

  const hasWebGL = () => {
    try {
      const testCanvas = document.createElement('canvas');
      const context = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!context) return false;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch {
      return false;
    }
  };

  const destroyScene = (disablePermanently = false) => {
    if (disablePermanently) permanentlyDisabled = true;
    if (!sceneState) return;

    const { geometry, material, renderer, frameId, onVisibilityChange } = sceneState;
    cancelAnimationFrame(frameId);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    try {
      renderer.clear(true, true, true);
      geometry.dispose();
      material.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    } catch {
      // El fondo CSS permanece visible aunque el navegador no permita liberar un recurso.
    }

    sceneState = null;
  };

  const startScene = async () => {
    initPending = false;
    if (permanentlyDisabled || sceneState || !canRunCanvas() || !hasWebGL()) return;

    let buildingRenderer = null;
    let buildingGeometry = null;
    let buildingMaterial = null;

    try {
      const THREE = await import('/vendor/three.module.min.js');
      if (permanentlyDisabled || !canRunCanvas() || sceneState) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
      buildingRenderer = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(window.innerWidth, window.innerHeight, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 3000);
      camera.position.z = 1000;

      const particleCount = 900;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const cyan = new THREE.Color('#00f0ff');
      const violet = new THREE.Color('#7c3aed');

      for (let index = 0; index < particleCount; index += 1) {
        const offset = index * 3;
        positions[offset] = (Math.random() - 0.5) * 2200;
        positions[offset + 1] = (Math.random() - 0.5) * 1500;
        positions[offset + 2] = (Math.random() - 0.5) * 1600;
        const color = Math.random() > 0.55 ? cyan : violet;
        colors[offset] = color.r;
        colors[offset + 1] = color.g;
        colors[offset + 2] = color.b;
      }

      const geometry = new THREE.BufferGeometry();
      buildingGeometry = geometry;
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 2.1,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.62,
        vertexColors: true,
        depthWrite: false,
      });
      buildingMaterial = material;
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      let frameId = 0;
      let lastFrameTime = 0;
      let frameSamples = [];
      const startedAt = performance.now();

      const onVisibilityChange = () => {
        if (document.hidden) {
          cancelAnimationFrame(frameId);
          frameId = 0;
          if (sceneState) sceneState.frameId = 0;
          lastFrameTime = 0;
        } else if (!frameId && sceneState) {
          frameId = requestAnimationFrame(renderFrame);
          sceneState.frameId = frameId;
        }
      };

      const renderFrame = (time) => {
        if (!sceneState || document.hidden) return;

        if (lastFrameTime) {
          frameSamples.push(time - lastFrameTime);
          if (frameSamples.length === 60) {
            const averageFrameTime = frameSamples.reduce((sum, sample) => sum + sample, 0) / frameSamples.length;
            if (averageFrameTime > 24) {
              destroyScene(true);
              return;
            }
            frameSamples = [];
          }
        }

        lastFrameTime = time;
        const elapsed = (time - startedAt) * 0.001;
        particles.rotation.y = elapsed * 0.008 + window.scrollY * 0.000035;
        particles.rotation.x = elapsed * 0.002 + window.scrollY * 0.000012;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(renderFrame);
        sceneState.frameId = frameId;
      };

      sceneState = { geometry, material, renderer, frameId, onVisibilityChange };
      buildingRenderer = null;
      buildingGeometry = null;
      buildingMaterial = null;
      document.addEventListener('visibilitychange', onVisibilityChange);
      if (!document.hidden) frameId = requestAnimationFrame(renderFrame);
      sceneState.frameId = frameId;
    } catch {
      try {
        buildingGeometry?.dispose();
        buildingMaterial?.dispose();
        buildingRenderer?.dispose();
        buildingRenderer?.forceContextLoss();
      } catch {
        // Si el montaje falla, el CSS sigue proporcionando el fondo de la página.
      }
      destroyScene();
    }
  };

  const scheduleScene = () => {
    if (!loadComplete || permanentlyDisabled || sceneState || initPending) return;
    initPending = true;
    const run = () => {
      if (initPending) void startScene();
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      window.setTimeout(run, 0);
    }
  };

  const onWindowResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (window.innerWidth < 900 || motionQuery.matches) {
        destroyScene(motionQuery.matches);
        return;
      }

      if (sceneState) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        sceneState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        sceneState.renderer.setSize(width, height, false);
        sceneState.renderer.domElement.style.width = `${width}px`;
        sceneState.renderer.domElement.style.height = `${height}px`;
      } else {
        scheduleScene();
      }
    }, 160);
  };

  window.addEventListener('resize', onWindowResize, { passive: true });
  motionQuery.addEventListener('change', (event) => {
    if (event.matches) destroyScene(true);
    else scheduleScene();
  });

  window.addEventListener('load', () => {
    loadComplete = true;
    scheduleScene();
  }, { once: true });
})();
