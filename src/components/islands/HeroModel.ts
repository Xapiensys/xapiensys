/**
 * Visor del modelo 3D del hero (la X de cristal y cromo) en WebGL nativo.
 * Sin Three.js: lee `public/3d/x.bin` (formato de scripts/pack-model.mjs) y dibuja con un
 * shader propio que simula un entorno de estudio con reflejos cian y violeta.
 * Es una isla diferida: la carga `sceneBoot.ts` después del contenido y solo en dispositivos aptos.
 */

const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv;
uniform mat4 uProj; uniform mat4 uMV;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  vec4 mv = uMV * vec4(aPos, 1.0);
  vN = (uMV * vec4(aNor, 0.0)).xyz;
  vV = -mv.xyz;
  vUv = aUv;
  gl_Position = uProj * mv;
}`;

const FS = `
precision mediump float;
uniform sampler2D uTex; uniform float uTime; uniform vec3 uCyan; uniform vec3 uViolet;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  vec3 base = texture2D(uTex, vUv).rgb;
  vec3 R = reflect(-V, N);
  float ndl = max(dot(N, normalize(vec3(0.45, 0.7, 0.85))), 0.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float up = smoothstep(0.1, 1.0, R.y * 0.5 + 0.5);
  vec3 env = mix(vec3(0.03, 0.04, 0.09), vec3(0.8, 0.9, 1.0), up);
  env += uCyan * smoothstep(0.1, 0.95, -R.x) * 0.7 + uViolet * smoothstep(0.1, 0.95, R.x) * 0.6;
  float core = smoothstep(0.05, 0.35, base.b - base.r);
  float spec = pow(max(dot(R, normalize(vec3(0.4, 0.8, 0.6))), 0.0), 36.0);
  vec3 col = base * (0.5 + 0.8 * ndl) + env * (0.3 + 0.85 * fres) + vec3(1.0) * spec * 0.9;
  col += base * base * core * (0.5 + 0.2 * sin(uTime * 1.6));
  col = col / (1.0 + col * 0.18);
  gl_FragColor = vec4(pow(col, vec3(0.95)), 1.0);
}`;

type Mat = Float32Array;

const mul = (a: Mat, b: Mat): Mat => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
      o[c * 4 + r] = s;
    }
  return o;
};

const rotX = (a: number): Mat => {
  const c = Math.cos(a),
    s = Math.sin(a);
  // prettier-ignore
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
};

const rotY = (a: number): Mat => {
  const c = Math.cos(a),
    s = Math.sin(a);
  // prettier-ignore
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
};

const scaleT = (s: number, tz: number): Mat =>
  // prettier-ignore
  new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, tz, 1]);

const perspective = (fovDeg: number, aspect: number, near: number, far: number): Mat => {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  // prettier-ignore
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
};

const readToken = (name: string, fallback: string): [number, number, number] => {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const v = parseInt(hex.replace('#', ''), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

function compile(gl: WebGLRenderingContext): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VS],
    [gl.FRAGMENT_SHADER, FS],
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

export async function mountHeroModel(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  base: string,
): Promise<() => void> {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error('webgl');

  const [binRes, texRes] = await Promise.all([fetch(`${base}/x.bin`), fetch(`${base}/x.webp`)]);
  if (!binRes.ok || !texRes.ok) throw new Error('model');
  const buf = await binRes.arrayBuffer();
  const bitmap = await createImageBitmap(await texRes.blob());

  const head = new Uint32Array(buf, 0, 2);
  const n = head[0]!;
  const idxCount = head[1]!;
  const posOff = 24;
  const norOff = posOff + n * 6;
  const uvOff = norOff + n * 4;
  const idxOff = uvOff + n * 4;

  const program = compile(gl);
  gl.useProgram(program);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf, posOff, idxOff - posOff), gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(buf, idxOff, idxCount * 2), gl.STATIC_DRAW);

  const attr = (
    name: string,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ) => {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, type, normalized, stride, offset);
  };
  attr('aPos', 3, gl.SHORT, true, 6, 0);
  attr('aNor', 3, gl.BYTE, true, 4, norOff - posOff);
  attr('aUv', 2, gl.UNSIGNED_SHORT, true, 4, uvOff - posOff);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  bitmap.close();
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const uProj = gl.getUniformLocation(program, 'uProj');
  const uMV = gl.getUniformLocation(program, 'uMV');
  const uTime = gl.getUniformLocation(program, 'uTime');
  gl.uniform3fv(gl.getUniformLocation(program, 'uCyan'), readToken('--color-cyan', '#00f0ff'));
  gl.uniform3fv(gl.getUniformLocation(program, 'uViolet'), readToken('--color-violet', '#7c3aed'));
  gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  let proj = perspective(30, 1, 0.1, 20);
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    proj = perspective(30, width / height, 0.1, 20);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  let mx = 0;
  let my = 0;
  let scrollP = 0;
  const onMove = (e: PointerEvent) => {
    mx = (e.clientX / innerWidth) * 2 - 1;
    my = (e.clientY / innerHeight) * 2 - 1;
  };
  const onScroll = () => {
    scrollP = Math.min(1, scrollY / Math.max(1, innerHeight));
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });

  let visible = true;
  let raf = 0;
  let ry = 0;
  let rx = 0;
  let idle = 0;
  let last = 0;
  let slowFrames = 0;
  let frames = 0;
  let stopped = false;

  const draw = (now: number) => {
    if (stopped || !visible || document.hidden) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(draw);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    if (last && now - last > 40) slowFrames += 1;
    last = now;
    frames += 1;
    if (frames === 90) {
      // Equipos lentos: se vuelve al póster en vez de entrecortar la página.
      if (slowFrames > 45) {
        destroy();
        return;
      }
      frames = 0;
      slowFrames = 0;
    }
    idle += dt;
    ry += (idle * 0.35 + scrollP * Math.PI * 1.2 + mx * 0.5 - ry) * 0.07;
    rx += (-0.12 + my * 0.3 + Math.sin(idle * 0.8) * 0.05 - rx) * 0.07;
    const mv = mul(
      scaleT(1, -4.1),
      mul(rotX(rx), mul(rotY(ry), mul(rotY(Math.PI / 2), scaleT(0.82, 0)))),
    );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uProj, false, proj);
    gl.uniformMatrix4fv(uMV, false, mv);
    gl.uniform1f(uTime, idle);
    gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0);
  };

  const start = () => {
    if (!raf && visible && !document.hidden && !stopped) raf = requestAnimationFrame(draw);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    start();
  });
  io.observe(stage);
  document.addEventListener('visibilitychange', start);

  function destroy() {
    stopped = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', start);
    stage.classList.remove('is-3d');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }

  draw(performance.now());
  stage.classList.add('is-3d');
  return destroy;
}
