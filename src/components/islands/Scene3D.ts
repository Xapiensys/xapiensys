/**
 * Red de nodos conectados en cian y violeta (metáfora de sistemas e IA), en WebGL nativo.
 * Decisión (ARCHITECTURE §12): `three` tree-shakeado pesaba ~530 KB minificado por
 * WebGLRenderer; esta versión cumple el presupuesto de ≤ 250 KB con el mismo efecto.
 */
import type { SceneQuality } from './sceneBoot';

const SETTINGS = {
  high: { particles: 3000, linkNodes: 220, linkDistance: 300 },
  medium: { particles: 1200, linkNodes: 120, linkDistance: 330 },
} as const;

const readToken = (name: string, fallback: string): [number, number, number] => {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const v = parseInt(hex.replace('#', ''), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

const POINT_VS = `
attribute vec3 aPos; attribute vec3 aColor; attribute float aSize;
uniform mat4 uProj; uniform mat4 uView; uniform float uTime; uniform float uDpr;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec3 p = aPos;
  p.y += sin(uTime * 0.25 + aPos.x * 0.004) * 6.0;
  vec4 mv = uView * vec4(p, 1.0);
  gl_PointSize = aSize * uDpr * (520.0 / -mv.z);
  vAlpha = clamp(1.0 - (-mv.z - 400.0) / 1800.0, 0.15, 0.9);
  vColor = aColor;
  gl_Position = uProj * mv;
}`;

const POINT_FS = `
precision mediump float;
varying vec3 vColor; varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * vAlpha);
}`;

const LINE_VS = `
attribute vec3 aPos; attribute float aAlpha;
uniform mat4 uProj; uniform mat4 uView; uniform float uTime;
varying float vAlpha;
void main() {
  vec3 p = aPos;
  p.y += sin(uTime * 0.25 + aPos.x * 0.004) * 6.0;
  vAlpha = aAlpha;
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

const LINE_FS = `
precision mediump float;
uniform vec3 uColor; varying float vAlpha;
void main() { gl_FragColor = vec4(uColor, vAlpha * 0.22); }`;

function compile(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('shader');
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
  return program;
}

function perspective(fovDeg: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

/** Vista: rotación X·Y del grupo y cámara en z = 1000 (column-major). */
function view(rx: number, ry: number): Float32Array {
  const cx = Math.cos(rx),
    sx = Math.sin(rx),
    cy = Math.cos(ry),
    sy = Math.sin(ry);
  // prettier-ignore
  return new Float32Array([
    cy, sx * sy, -cx * sy, 0,
    0, cx, sx, 0,
    sy, -sx * cy, cx * cy, 0,
    0, 0, -1000, 1,
  ]);
}

export interface SceneHandle {
  destroy: () => void;
}

export function mountScene(
  canvas: HTMLCanvasElement,
  { quality, anchor }: { quality: SceneQuality; anchor: HTMLElement | null },
): SceneHandle | null {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;

  const cfg = SETTINGS[quality];
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const cyan = readToken('--color-cyan', '#00f0ff');
  const violet = readToken('--color-violet', '#7c3aed');

  let pointProg: WebGLProgram;
  let lineProg: WebGLProgram;
  try {
    pointProg = compile(gl, POINT_VS, POINT_FS);
    lineProg = compile(gl, LINE_VS, LINE_FS);
  } catch {
    return null;
  }

  // Nodos: [x, y, z, r, g, b, size]
  const n = cfg.particles;
  const nodes = new Float32Array(n * 7);
  for (let i = 0; i < n; i += 1) {
    const o = i * 7;
    const c = Math.random() > 0.55 ? cyan : violet;
    nodes.set(
      [
        (Math.random() - 0.5) * 2400,
        (Math.random() - 0.5) * 1500,
        (Math.random() - 0.5) * 1600,
        ...c,
        i < cfg.linkNodes ? 3.2 : 1.4 + Math.random() * 1.2,
      ],
      o,
    );
  }

  // Conexiones entre nodos principales: [x, y, z, alpha] por vértice
  const lines: number[] = [];
  for (let a = 0; a < cfg.linkNodes; a += 1) {
    for (let b = a + 1; b < cfg.linkNodes; b += 1) {
      const dx = nodes[a * 7]! - nodes[b * 7]!;
      const dy = nodes[a * 7 + 1]! - nodes[b * 7 + 1]!;
      const dz = nodes[a * 7 + 2]! - nodes[b * 7 + 2]!;
      const d = Math.hypot(dx, dy, dz);
      if (d < cfg.linkDistance) {
        const alpha = 1 - d / cfg.linkDistance;
        lines.push(nodes[a * 7]!, nodes[a * 7 + 1]!, nodes[a * 7 + 2]!, alpha);
        lines.push(nodes[b * 7]!, nodes[b * 7 + 1]!, nodes[b * 7 + 2]!, alpha);
      }
    }
  }
  const lineData = new Float32Array(lines);

  const nodeBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, nodes, gl.STATIC_DRAW);
  const lineBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
  gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.STATIC_DRAW);

  const loc = (p: WebGLProgram) => ({
    pos: gl.getAttribLocation(p, 'aPos'),
    color: gl.getAttribLocation(p, 'aColor'),
    size: gl.getAttribLocation(p, 'aSize'),
    alpha: gl.getAttribLocation(p, 'aAlpha'),
    proj: gl.getUniformLocation(p, 'uProj'),
    view: gl.getUniformLocation(p, 'uView'),
    time: gl.getUniformLocation(p, 'uTime'),
    dpr: gl.getUniformLocation(p, 'uDpr'),
    lineColor: gl.getUniformLocation(p, 'uColor'),
  });
  const pl = loc(pointProg);
  const ll = loc(lineProg);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // aditivo
  gl.clearColor(0, 0, 0, 0);

  let proj = perspective(55, innerWidth / innerHeight, 1, 3000);
  const resize = () => {
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    proj = perspective(55, innerWidth / innerHeight, 1, 3000);
  };
  resize();

  const rot = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };
  const startTime = performance.now();

  const draw = (t: number) => {
    const elapsed = (t - startTime) * 0.001;
    rot.y += (elapsed * 0.01 + pointer.x * 0.25 + scrollY * 0.00004 - rot.y) * 0.04;
    rot.x += (pointer.y * 0.12 + scrollY * 0.000015 - rot.x) * 0.04;
    const v = view(rot.x, rot.y);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(lineProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.enableVertexAttribArray(ll.pos);
    gl.vertexAttribPointer(ll.pos, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(ll.alpha);
    gl.vertexAttribPointer(ll.alpha, 1, gl.FLOAT, false, 16, 12);
    gl.uniformMatrix4fv(ll.proj, false, proj);
    gl.uniformMatrix4fv(ll.view, false, v);
    gl.uniform1f(ll.time, elapsed);
    gl.uniform3fv(ll.lineColor, cyan);
    gl.drawArrays(gl.LINES, 0, lineData.length / 4);
    gl.disableVertexAttribArray(ll.alpha);

    gl.useProgram(pointProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
    gl.enableVertexAttribArray(pl.pos);
    gl.vertexAttribPointer(pl.pos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(pl.color);
    gl.vertexAttribPointer(pl.color, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(pl.size);
    gl.vertexAttribPointer(pl.size, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(pl.proj, false, proj);
    gl.uniformMatrix4fv(pl.view, false, v);
    gl.uniform1f(pl.time, elapsed);
    gl.uniform1f(pl.dpr, dpr);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disableVertexAttribArray(pl.color);
    gl.disableVertexAttribArray(pl.size);
  };

  let frame = 0;
  let running = false;
  let heroVisible = true;
  let last = 0;
  let slowFrames = 0;

  const loop = (t: number) => {
    if (!running) return;
    if (last) {
      // Si el dispositivo no sostiene ~40 fps, apagamos la escena.
      slowFrames = t - last > 26 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 90) {
        destroy();
        return;
      }
    }
    last = t;
    draw(t);
    frame = requestAnimationFrame(loop);
  };

  const play = () => {
    if (running || document.hidden || !heroVisible) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(loop);
  };
  const pause = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  const onPointer = (e: PointerEvent) => {
    pointer.x = e.clientX / innerWidth - 0.5;
    pointer.y = e.clientY / innerHeight - 0.5;
  };
  const onVisibility = () => (document.hidden ? pause() : play());
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      if (!running) draw(performance.now());
    }, 150);
  };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => motion.matches && destroy();

  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', onMotion);

  const observer = anchor
    ? new IntersectionObserver(([entry]) => {
        heroVisible = Boolean(entry?.isIntersecting);
        if (heroVisible) play();
        else pause();
      })
    : null;
  if (anchor) observer!.observe(anchor);

  function destroy() {
    pause();
    observer?.disconnect();
    removeEventListener('pointermove', onPointer);
    removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    motion.removeEventListener('change', onMotion);
    canvas.classList.remove('is-ready');
    gl!.deleteBuffer(nodeBuf);
    gl!.deleteBuffer(lineBuf);
    gl!.deleteProgram(pointProg);
    gl!.deleteProgram(lineProg);
    gl!.getExtension('WEBGL_lose_context')?.loseContext();
  }

  draw(startTime);
  requestAnimationFrame(() => canvas.classList.add('is-ready'));
  play();
  return { destroy };
}
