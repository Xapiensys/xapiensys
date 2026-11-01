/**
 * Empaqueta el GLB de Higgsfield/Tripo (assets/src/x-raw.glb) en un formato mínimo para
 * `HeroModel.ts`: geometría cuantizada en `public/3d/x.bin` + textura de color en `public/3d/x.webp`.
 * Uso: node scripts/pack-model.mjs assets/src/x-raw.glb
 *
 * x.bin (little-endian): u32 vértices, u32 índices, f32 centro[3], f32 semiextensión,
 * luego Int16 pos (3/vértice), Int8 normal (4/vértice, el 4.º es relleno), Uint16 uv (2/vértice),
 * Uint16 índices.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Uso: node scripts/pack-model.mjs <modelo.glb>');

const glb = readFileSync(input);
const jsonLen = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart);

const prim = gltf.meshes[0].primitives[0];
const reader = (accIndex, comps) => {
  const acc = gltf.accessors[accIndex];
  const view = gltf.bufferViews[acc.bufferView];
  const stride = view.byteStride ?? comps * 4;
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  return { acc, get: (i, c) => bin.readFloatLE(base + i * stride + c * 4) };
};

const pos = reader(prim.attributes.POSITION, 3);
const nor = reader(prim.attributes.NORMAL, 3);
const uv = reader(prim.attributes.TEXCOORD_0, 2);
const n = pos.acc.count;

const { min, max } = pos.acc;
const center = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
const half = Math.max(...[0, 1, 2].map((k) => (max[k] - min[k]) / 2));

const idxAcc = gltf.accessors[prim.indices];
const idxView = gltf.bufferViews[idxAcc.bufferView];
const idxBase = (idxView.byteOffset ?? 0) + (idxAcc.byteOffset ?? 0);
const idxCount = idxAcc.count;
if (n > 65535) throw new Error('Más de 65535 vértices: hace falta índice de 32 bits');

const size = 24 + n * 6 + n * 4 + n * 4 + idxCount * 2;
const out = Buffer.alloc(size);
out.writeUInt32LE(n, 0);
out.writeUInt32LE(idxCount, 4);
center.forEach((c, k) => out.writeFloatLE(c, 8 + k * 4));
out.writeFloatLE(half, 20);

let o = 24;
for (let i = 0; i < n; i++) {
  for (let k = 0; k < 3; k++) {
    out.writeInt16LE(Math.round(((pos.get(i, k) - center[k]) / half) * 32767), o);
    o += 2;
  }
}
for (let i = 0; i < n; i++) {
  for (let k = 0; k < 3; k++)
    out.writeInt8(Math.max(-127, Math.min(127, Math.round(nor.get(i, k) * 127))), o++);
  out.writeInt8(0, o++);
}
let uvMin = 1,
  uvMax = 0;
for (let i = 0; i < n; i++) {
  for (let k = 0; k < 2; k++) {
    const v = uv.get(i, k);
    uvMin = Math.min(uvMin, v);
    uvMax = Math.max(uvMax, v);
    out.writeUInt16LE(Math.round(Math.max(0, Math.min(1, v)) * 65535), o);
    o += 2;
  }
}
if (uvMin < -0.001 || uvMax > 1.001) console.warn(`Aviso: UV fuera de 0..1 (${uvMin}..${uvMax})`);
for (let i = 0; i < idxCount; i++) {
  const v =
    idxAcc.componentType === 5125
      ? bin.readUInt32LE(idxBase + i * 4)
      : bin.readUInt16LE(idxBase + i * 2);
  out.writeUInt16LE(v, o);
  o += 2;
}

// Textura de color: la imagen referenciada por baseColorTexture.
const mat = gltf.materials[prim.material ?? 0];
const tex = gltf.textures[mat.pbrMetallicRoughness.baseColorTexture.index];
const imgIndex = tex.extensions?.EXT_texture_webp?.source ?? tex.source;
const img = gltf.images[imgIndex];
const iv = gltf.bufferViews[img.bufferView];
const imgBytes = bin.subarray(iv.byteOffset ?? 0, (iv.byteOffset ?? 0) + iv.byteLength);

mkdirSync('public/3d', { recursive: true });
writeFileSync('public/3d/x.bin', out);
writeFileSync(
  'public/3d/x.' +
    (img.mimeType === 'image/webp' ? 'webp' : img.mimeType === 'image/png' ? 'png' : 'jpg'),
  imgBytes,
);
console.log(
  `x.bin ${out.length} B · vértices ${n} · índices ${idxCount} · textura ${img.mimeType} ${imgBytes.length} B`,
);
