import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function renderOrganizaPng(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const outerRadius = size * 0.31;
  const innerRadius = size * 0.175;
  const cardRadius = size * 0.22;

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const px = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);

      // Fondo Titanium #0A0B0D con tarjeta interna #14161A y anillo Coral #FA6B6B
      const inInnerCard =
        Math.abs(dx) <= size * 0.42 &&
        Math.abs(dy) <= size * 0.42 &&
        Math.hypot(
          Math.max(0, Math.abs(dx) - (size * 0.42 - cardRadius)),
          Math.max(0, Math.abs(dy) - (size * 0.42 - cardRadius))
        ) <= cardRadius;

      let r = inInnerCard ? 20 : 10;
      let g = inInnerCard ? 22 : 11;
      let b = inInnerCard ? 26 : 13;

      if (dist <= outerRadius + 0.8 && dist >= innerRadius - 0.8) {
        const edgeOuter = Math.max(0, Math.min(1, outerRadius + 0.8 - dist));
        const edgeInner = Math.max(0, Math.min(1, dist - (innerRadius - 0.8)));
        const alpha = Math.min(edgeOuter, edgeInner);
        r = Math.round(r * (1 - alpha) + 250 * alpha);
        g = Math.round(g * (1 - alpha) + 107 * alpha);
        b = Math.round(b * (1 - alpha) + 107 * alpha);
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  fs.writeFileSync(path.join(iconsDir, t.name), renderOrganizaPng(t.size));
}

console.log(`Generated ${targets.length} PWA icons in ${iconsDir}`);
